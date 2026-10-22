const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, leerMarcas, perfil, revisar, motivoComun, soloMarca, omitir,
       insertarAsignaciones, enTransaccion} = require('./comun')

/////Lo que solo hace la jefatura con las marcas de su familia:
/////  asignar  -> darle marcas a un especialista, o pasarselas de otro especialista
/////  retirar  -> quitarle marcas a un especialista
/////  estado   -> marcar una marca como trabajada o no trabajada
/////
/////Puede hacerlo aunque el especialista ya haya confirmado. Lo que no puede es soltar sus
/////propias marcas una vez que ella confirmo.

/////Comprobaciones comunes. Devuelve {yo} o {rechazo}.
async function comoJefatura(conexion, codusu){
    const yo = await perfil(conexion, codusu, false);
    if(yo.rol !== 'JEFATURA') return {rechazo:"solo jefatura"};
    if(!yo.familia) return {rechazo:"jefatura sin familia"};
    return {yo};
}

/////El destino tiene que ser un especialista del grupo 25 y no la propia jefatura:
/////sus propias marcas las toma con /marcas/confirmar.
async function especialistaDestino(conexion, yo, destino){
    if(!destino || destino === yo.codusu) return {rechazo:"destino invalido"};
    const r = await ejecutar(conexion,
        `select top 1 rtrim(isnull(u.nomusu, x.nombre)) from tbl_api_vendedores_diferenciador x
         left join fcu0000 u on u.codusu=rtrim(x.codusu)
         where rtrim(x.codusu)=@destino and x.codgru=25 and rtrim(x.diferenciador)='ESPECIALISTA'`,
        [{nombre:'destino',tipo:TYPES.VarChar,valor:destino}]);
    if(r.rows.length === 0) return {rechazo:"destino no especialista"};
    return {nombre:texto(r.rows[0][0].value)};
}

function codigosEn(codigos, parametros){
    return codigos.map((codmar,i)=>{
        parametros.push({nombre:`m${i}`,tipo:TYPES.Char,valor:codmar});
        return `@m${i}`;
    }).join(',');
}

/////Cuerpo: {"codusu":"229","marcas":["0024","0036"]}
let marcas_asignar = (resolve,reject,conexion,galleta,cuerpo)=>{
    const codusu = texto(galleta ? galleta.identificador : null);
    if(!codusu){ conexion.close(); return reject("falsa galleta"); }
    const destino = texto(cuerpo ? cuerpo.codusu : null);
    const codigos = leerMarcas(cuerpo ? cuerpo.marcas : null);
    if(codigos === null || codigos.length === 0){ conexion.close(); return reject("marcas invalidas"); }

    enTransaccion(resolve, reject, conexion, 'marcas asignar', async ()=>{
        const jefe = await comoJefatura(conexion, codusu);
        if(jefe.rechazo) return jefe;
        const yo = jefe.yo;
        const esp = await especialistaDestino(conexion, yo, destino);
        if(esp.rechazo) return esp;

        const revisadas = await revisar(conexion, codigos, yo.anno, yo.mes);
        const nuevas = [], movidas = [], yaTenia = [], omitidas = [];

        for(const m of revisadas){
            let motivo = motivoComun(m);
            if(!motivo && m.codfam !== yo.familia) motivo = "la marca no es de tu familia";
            if(!motivo && m.dueno === codusu && yo.confirmadoEn) motivo = "la marca es tuya y ya confirmaste tus marcas del mes";

            if(motivo) omitidas.push(omitir(m, motivo));
            else if(m.dueno === destino) yaTenia.push(soloMarca(m));
            else if(m.dueno) movidas.push(Object.assign(soloMarca(m), {movidaDe: m.nombreDueno || m.dueno}));
            else nuevas.push(soloMarca(m));
        }

        await insertarAsignaciones(conexion, yo.anno, yo.mes, nuevas.map(m=>m.codmar), destino, codusu);

        if(movidas.length > 0){
            const parametros = [
                {nombre:'anno',tipo:TYPES.Int,valor:yo.anno},
                {nombre:'mes',tipo:TYPES.Int,valor:yo.mes},
                {nombre:'destino',tipo:TYPES.VarChar,valor:destino},
                {nombre:'por',tipo:TYPES.VarChar,valor:codusu}
            ];
            const lista = codigosEn(movidas.map(m=>m.codmar), parametros);
            await ejecutar(conexion,
                `update tbl01_api_marcas_asignadas set codusu=@destino, asignado_por=@por, fecreg=getdate()
                 where anno=@anno and mes=@mes and codmar in (${lista})`,
                parametros);
        }

        return {
            especialista: {codusu:destino, nombre:esp.nombre},
            asignadas: nuevas.concat(movidas),
            yaTenia: yaTenia,
            omitidas: omitidas
        };
    });
}

/////Cuerpo: {"codusu":"229","marcas":["0024"]}
let marcas_retirar = (resolve,reject,conexion,galleta,cuerpo)=>{
    const codusu = texto(galleta ? galleta.identificador : null);
    if(!codusu){ conexion.close(); return reject("falsa galleta"); }
    const destino = texto(cuerpo ? cuerpo.codusu : null);
    const codigos = leerMarcas(cuerpo ? cuerpo.marcas : null);
    if(codigos === null || codigos.length === 0){ conexion.close(); return reject("marcas invalidas"); }

    enTransaccion(resolve, reject, conexion, 'marcas retirar', async ()=>{
        const jefe = await comoJefatura(conexion, codusu);
        if(jefe.rechazo) return jefe;
        const yo = jefe.yo;
        const esp = await especialistaDestino(conexion, yo, destino);
        if(esp.rechazo) return esp;

        const revisadas = await revisar(conexion, codigos, yo.anno, yo.mes);
        const retiradas = [], omitidas = [];

        for(const m of revisadas){
            let motivo = null;
            if(m.nombre == null)              motivo = "la marca no existe";
            else if(m.dueno !== destino)      motivo = "el especialista no tiene esta marca este mes";
            else if(m.codfam !== yo.familia)  motivo = "la marca no es de tu familia";

            if(motivo) omitidas.push(Object.assign(soloMarca(m), {motivo:motivo}));
            else retiradas.push(soloMarca(m));
        }

        if(retiradas.length > 0){
            const parametros = [
                {nombre:'anno',tipo:TYPES.Int,valor:yo.anno},
                {nombre:'mes',tipo:TYPES.Int,valor:yo.mes},
                {nombre:'destino',tipo:TYPES.VarChar,valor:destino}
            ];
            const lista = codigosEn(retiradas.map(m=>m.codmar), parametros);
            await ejecutar(conexion,
                `delete from tbl01_api_marcas_asignadas
                 where anno=@anno and mes=@mes and codusu=@destino and codmar in (${lista})`,
                parametros);
        }

        return {especialista:{codusu:destino, nombre:esp.nombre}, retiradas:retiradas, omitidas:omitidas};
    });
}

/////Cuerpo: {"codmar":"0021","trabajada":false}
/////Si la marca existe pero no esta en el catalogo (una marca nueva), queda incorporada a la
/////familia de la jefatura. Dejar de trabajar una marca no se la quita a quien la tiene este
/////mes: su cuota ya se calcula con ella. Desde el mes siguiente nadie la podra tomar.
let marcas_estado = (resolve,reject,conexion,galleta,cuerpo)=>{
    const codusu = texto(galleta ? galleta.identificador : null);
    if(!codusu){ conexion.close(); return reject("falsa galleta"); }
    const codmar = texto(cuerpo ? cuerpo.codmar : null);
    const trabajada = leerBooleano(cuerpo ? cuerpo.trabajada : null);
    if(!codmar || !/^[0-9]{4}$/.test(codmar)){ conexion.close(); return reject("marcas invalidas"); }
    if(trabajada === null){ conexion.close(); return reject("estado invalido"); }

    enTransaccion(resolve, reject, conexion, 'marcas estado', async ()=>{
        const jefe = await comoJefatura(conexion, codusu);
        if(jefe.rechazo) return jefe;
        const yo = jefe.yo;

        const r = await ejecutar(conexion,
            `select rtrim(m.abrmar), rtrim(m.Nommar), e.codfam, rtrim(u.nomusu), rtrim(a.codusu)
             from tbl01mar m
             left join tbl01_api_marcas_estado e with (updlock, holdlock) on e.codmar=m.codmar
             left join tbl01_api_marcas_asignadas a on a.anno=@anno and a.mes=@mes and a.codmar=m.codmar
             left join fcu0000 u on u.codusu=a.codusu
             where m.codmar=@codmar`,
            [{nombre:'codmar',tipo:TYPES.Char,valor:codmar},
             {nombre:'anno',tipo:TYPES.Int,valor:yo.anno},
             {nombre:'mes',tipo:TYPES.Int,valor:yo.mes}]);
        if(r.rows.length === 0) return {rechazo:"marca desconocida"};

        const f = r.rows[0];
        const codfam = texto(f[2].value);
        if(codfam && codfam !== yo.familia) return {rechazo:"marca de otra familia"};

        const parametros = [
            {nombre:'codmar',tipo:TYPES.Char,valor:codmar},
            {nombre:'codfam',tipo:TYPES.Char,valor:yo.familia},
            {nombre:'trabajada',tipo:TYPES.Bit,valor:trabajada},
            {nombre:'codusu',tipo:TYPES.VarChar,valor:codusu}
        ];
        if(codfam){
            await ejecutar(conexion,
                "update tbl01_api_marcas_estado set trabajada=@trabajada, codusu=@codusu, fecreg=getdate() where codmar=@codmar",
                parametros);
        }else{
            await ejecutar(conexion,
                "insert into tbl01_api_marcas_estado(codmar,codfam,trabajada,codusu) values(@codmar,@codfam,@trabajada,@codusu)",
                parametros);
        }

        const dueno = texto(f[4].value);
        return {
            codmar: codmar,
            abrmar: texto(f[0].value),
            nombre: texto(f[1].value),
            codfam: yo.familia,
            trabajada: trabajada,
            incorporada: !codfam,
            asignadaEsteMesA: dueno ? (texto(f[3].value) || dueno) : null
        };
    });
}

function leerBooleano(valor){
    if(valor === true || valor === 1 || valor === '1' || valor === 'true') return true;
    if(valor === false || valor === 0 || valor === '0' || valor === 'false') return false;
    return null;
}

module.exports={marcas_asignar, marcas_retirar, marcas_estado}
