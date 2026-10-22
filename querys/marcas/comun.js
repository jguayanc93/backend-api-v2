const {Request,TYPES} = require('../../conexion/cadena')
const {MAX_MARCAS_REGISTRO} = require('../../funciones/comunes/constantes')

/////Piezas compartidas por todas las consultas de marcas del grupo 25 y por el registro.
/////
/////Las tablas:
/////  tbl01_api_jefatura_familia    codfam -> codusu de la jefatura (una por familia)
/////  tbl01_api_marcas_estado       codmar -> su familia y si se trabaja
/////  tbl01_api_marcas_asignadas    (anno, mes, codmar) -> su unico dueño en el mes
/////  tbl01_api_marcas_confirmadas  (anno, mes, codusu) -> ya confirmo sus marcas del mes
/////
/////Reglas:
/////  - una marca tiene un solo dueño en el mes (la clave primaria lo garantiza)
/////  - al confirmar, el especialista o la jefatura ya no puede tocar sus propias marcas
/////    hasta el mes siguiente: la cuota se calcula sobre ellas
/////  - la jefatura si puede dar, pasar y quitar marcas de su familia a los especialistas,
/////    aunque ya hayan confirmado

function ejecutar(conexion, sql, parametros){
    return new Promise((resolve,reject)=>{
        const consulta = new Request(sql,(err,rowCount,rows)=>{
            if(err) return reject(err);
            resolve({rowCount:rowCount, rows:rows||[]});
        });
        /////opciones: precision y escala de los Decimal (sin ellas tedious redondea a 0 decimales)
        (parametros||[]).forEach(p=>consulta.addParameter(p.nombre,p.tipo,p.valor,p.opciones));
        conexion.execSql(consulta);
    });
}
function iniciar(conexion,nombre){
    return new Promise((res,rej)=>conexion.beginTransaction(e=>e?rej(e):res(),nombre||'marcas'));
}
function confirmar(conexion){
    return new Promise((res,rej)=>conexion.commitTransaction(e=>e?rej(e):res()));
}
function revertir(conexion){
    /////no se propaga el error del rollback: ya estamos en el camino de fallo
    return new Promise((res)=>conexion.rollbackTransaction(()=>res()));
}

function texto(valor){ return valor == null ? null : String(valor).trim(); }

function mesAnterior(anno, mes){ return mes === 1 ? {anno:anno-1, mes:12} : {anno:anno, mes:mes-1}; }

/////Las marcas llegan como venian del buscador de marcas: [codmar, abrmar, nombre], o solo
/////el codmar. Por multipart llegan como texto, asi que tambien se acepta el JSON.
/////Devuelve la lista de codmar sin repetir, o null si algo no tiene forma de codmar.
function leerMarcas(valor){
    if(valor == null || valor === '') return [];
    let lista = valor;
    if(typeof lista === 'string'){
        try{ lista = JSON.parse(lista); }
        catch(e){ lista = lista.split(','); }
    }
    if(!Array.isArray(lista)) lista = (lista && typeof lista === 'object') ? Object.values(lista) : [lista];

    const codigos = [];
    for(const item of lista){
        const crudo = Array.isArray(item) ? item[0] : (item && typeof item === 'object' ? item.codmar : item);
        const codmar = String(crudo == null ? '' : crudo).trim();
        if(!/^[0-9]{4}$/.test(codmar)) return null;
        if(!codigos.includes(codmar)) codigos.push(codmar);
    }
    if(codigos.length > MAX_MARCAS_REGISTRO) return null;
    return codigos;
}

/////Quien es el usuario para el modulo de marcas, y el mes en curso segun el servidor.
/////Con bloquear=true deja tomada la fila de confirmacion hasta el fin de la transaccion,
/////para que dos "confirmar" a la vez no pasen los dos.
async function perfil(conexion, codusu, bloquear){
    const hint = bloquear ? 'with (updlock, holdlock)' : '';
    const r = await ejecutar(conexion,
        `select (select top 1 rtrim(diferenciador) from tbl_api_vendedores_diferenciador where codusu=@codusu),
                (select codfam from tbl01_api_jefatura_familia where codusu=@codusu),
                (select rtrim(nomfam) from tbl01fam where codfam=(select codfam from tbl01_api_jefatura_familia where codusu=@codusu)),
                year(getdate()), month(getdate()),
                (select fecreg from tbl01_api_marcas_confirmadas ${hint}
                 where anno=year(getdate()) and mes=month(getdate()) and codusu=@codusu)`,
        [{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu}]);
    const f = r.rows[0];
    const tipo = texto(f[0].value);
    const familia = texto(f[1].value);
    return {
        codusu: codusu,
        tipo: tipo,
        /////es jefatura quien tiene familia cargada, diga lo que diga su diferenciador
        rol: familia ? 'JEFATURA' : tipo,
        familia: familia,
        nombreFamilia: texto(f[2].value),
        anno: f[3].value,
        mes: f[4].value,
        confirmadoEn: f[5].value || null
    };
}

/////Estado de cada marca pedida en el mes: si existe, su familia, si se trabaja y de quien es.
/////Bloquea las filas del mes de esas marcas hasta el fin de la transaccion.
async function revisar(conexion, codigos, anno, mes){
    if(codigos.length === 0) return [];
    const parametros = [
        {nombre:'anno',tipo:TYPES.Int,valor:anno},
        {nombre:'mes',tipo:TYPES.Int,valor:mes}
    ];
    const valores = codigos.map((codmar,i)=>{
        parametros.push({nombre:`m${i}`,tipo:TYPES.Char,valor:codmar});
        return `(@m${i})`;
    }).join(',');

    const r = await ejecutar(conexion,
        `select p.codmar, rtrim(m.abrmar), rtrim(m.Nommar), e.codfam, e.trabajada,
                rtrim(a.codusu), rtrim(u.nomusu)
         from (values ${valores}) p(codmar)
         left join tbl01mar m on m.codmar=p.codmar
         left join tbl01_api_marcas_estado e on e.codmar=p.codmar
         left join tbl01_api_marcas_asignadas a with (updlock, holdlock)
                on a.anno=@anno and a.mes=@mes and a.codmar=p.codmar
         left join fcu0000 u on u.codusu=a.codusu`,
        parametros);

    return r.rows.map(f=>({
        codmar: texto(f[0].value),
        abrmar: texto(f[1].value),
        nombre: texto(f[2].value),
        codfam: texto(f[3].value),
        trabajada: f[4].value,
        dueno: texto(f[5].value),
        nombreDueno: texto(f[6].value)
    }));
}

/////El motivo comun por el que una marca no se puede dar, o null si se puede.
function motivoComun(m){
    if(m.nombre == null)       return "la marca no existe";
    if(m.codfam == null)       return "la marca no esta en el catalogo de marcas";
    if(m.trabajada === false)  return "la marca ya no se trabaja";
    return null;
}

function soloMarca(m){ return {codmar:m.codmar, abrmar:m.abrmar, nombre:m.nombre}; }

function omitir(m, motivo){
    const o = Object.assign(soloMarca(m), {motivo:motivo});
    if(m.dueno) o.asignadaA = m.nombreDueno || m.dueno;
    return o;
}

async function insertarAsignaciones(conexion, anno, mes, codigos, codusu, asignadoPor){
    if(codigos.length === 0) return;
    const parametros = [
        {nombre:'anno',tipo:TYPES.Int,valor:anno},
        {nombre:'mes',tipo:TYPES.Int,valor:mes},
        {nombre:'codusu',tipo:TYPES.VarChar,valor:codusu},
        {nombre:'por',tipo:TYPES.VarChar,valor:asignadoPor}
    ];
    const filas = codigos.map((codmar,i)=>{
        parametros.push({nombre:`m${i}`,tipo:TYPES.Char,valor:codmar});
        return `(@anno,@mes,@m${i},@codusu,@por)`;
    }).join(',');
    await ejecutar(conexion,
        `INSERT INTO tbl01_api_marcas_asignadas(anno,mes,codmar,codusu,asignado_por) VALUES ${filas}`,
        parametros);
}

/////El usuario toma para si las marcas pedidas (registro y /marcas/confirmar).
/////Las que ya eran suyas (porque se las dio su jefatura) van en yaTenia.
async function tomarMarcas(conexion, yo, codigos){
    const revisadas = await revisar(conexion, codigos, yo.anno, yo.mes);
    const asignadas = [], omitidas = [], yaTenia = [];

    for(const m of revisadas){
        let motivo = motivoComun(m);
        if(!motivo && m.dueno && m.dueno !== yo.codusu) motivo = "la marca ya esta asignada a otro este mes";
        if(!motivo && yo.familia && m.codfam !== yo.familia) motivo = "la marca no es de la familia de su jefatura";

        if(motivo) omitidas.push(omitir(m, motivo));
        else if(m.dueno === yo.codusu) yaTenia.push(soloMarca(m));
        else asignadas.push(soloMarca(m));
    }

    await insertarAsignaciones(conexion, yo.anno, yo.mes, asignadas.map(m=>m.codmar), yo.codusu, yo.codusu);
    return {asignadas, omitidas, yaTenia};
}

async function marcarConfirmado(conexion, anno, mes, codusu){
    await ejecutar(conexion,
        "INSERT INTO tbl01_api_marcas_confirmadas(anno,mes,codusu) VALUES(@anno,@mes,@codusu)",
        [{nombre:'anno',tipo:TYPES.Int,valor:anno},
         {nombre:'mes',tipo:TYPES.Int,valor:mes},
         {nombre:'codusu',tipo:TYPES.VarChar,valor:codusu}]);
}

/////Corre fn dentro de una transaccion. fn puede devolver {rechazo:"motivo"} para
/////revertir y rechazar con ese motivo; cualquier otra cosa se confirma y se resuelve.
async function enTransaccion(resolve, reject, conexion, nombre, fn){
    let abierta=false;
    try{
        await iniciar(conexion,nombre);
        abierta=true;
        const resultado = await fn();
        if(resultado && resultado.rechazo){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject(resultado.rechazo);
        }
        /////rechazar pero conservando lo hecho (por ejemplo, marcar una solicitud como cerrada
        /////y avisar que ya no se puede ajustar)
        if(resultado && resultado.rechazoGuardando){
            await confirmar(conexion); abierta=false;
            conexion.close();
            return reject(resultado.rechazoGuardando);
        }
        await confirmar(conexion); abierta=false;
        conexion.close();
        resolve(resultado);
    }
    catch(err){
        console.error(`[${nombre}]`, err && err.message ? err.message : err);
        if(abierta) await revertir(conexion);
        conexion.close();
        reject("error query");
    }
}

/////Igual que enTransaccion pero solo lectura: sin transaccion.
async function soloLectura(resolve, reject, conexion, nombre, fn){
    try{
        const resultado = await fn();
        conexion.close();
        if(resultado && resultado.rechazo) return reject(resultado.rechazo);
        resolve(resultado);
    }
    catch(err){
        console.error(`[${nombre}]`, err && err.message ? err.message : err);
        conexion.close();
        reject("error query");
    }
}

/////Las marcas que el usuario puede consultar en reportes y cuota (las del mes en curso):
/////  - especialista: las que tiene asignadas, las haya confirmado o no
/////  - jefatura: las asignadas de su familia, es decir las suyas y las de sus especialistas
/////Con codmar, solo esa (para comprobar el permiso).
async function marcasPermitidas(conexion, yo, codmar){
    const r = await ejecutar(conexion,
        `select a.codmar, rtrim(m.abrmar), rtrim(m.Nommar), e.codfam, rtrim(f.nomfam),
                rtrim(a.codusu), rtrim(u.nomusu),
                (select count(*) from prd0101 p where p.estado=1 and p.codmar=a.codmar),
                case when c.codusu is null then 0 else 1 end,
                e.trabajada
         from tbl01_api_marcas_asignadas a
         join tbl01mar m on m.codmar=a.codmar
         left join tbl01_api_marcas_estado e on e.codmar=a.codmar
         left join tbl01fam f on f.codfam=e.codfam
         left join fcu0000 u on u.codusu=a.codusu
         left join tbl01_api_marcas_confirmadas c on c.anno=a.anno and c.mes=a.mes and c.codusu=a.codusu
         where a.anno=@anno and a.mes=@mes
           and ${yo.familia ? 'e.codfam=@codfam' : 'a.codusu=@codusu'}
           ${codmar ? 'and a.codmar=@codmar' : ''}
         order by m.Nommar`,
        [{nombre:'anno',tipo:TYPES.Int,valor:yo.anno},
         {nombre:'mes',tipo:TYPES.Int,valor:yo.mes},
         {nombre:'codfam',tipo:TYPES.Char,valor:yo.familia},
         {nombre:'codusu',tipo:TYPES.VarChar,valor:yo.codusu},
         {nombre:'codmar',tipo:TYPES.Char,valor:codmar||null}]);
    return r.rows.map(f=>{
        const dueno = texto(f[5].value);
        return {
            codmar: texto(f[0].value), abrmar: texto(f[1].value), nombre: texto(f[2].value),
            codfam: texto(f[3].value), familia: texto(f[4].value),
            /////productos vigentes de la marca: las filas que traeran stock y precios
            productos: f[7].value,
            dueno: {codusu:dueno, nombre:texto(f[6].value), soyYo: dueno === yo.codusu},
            /////el dueño ya confirmo sus marcas del mes
            confirmada: f[8].value === 1,
            /////si HOY se trabaja (el catalogo no guarda historia): en meses pasados sirve para
            /////avisar que una marca que se tuvo ya no se trabaja
            trabajadaHoy: f[9].value !== false
        };
    });
}

/////Quien pregunta y si es del grupo de marcas. Devuelve {yo} o {rechazo}.
async function quienPregunta(conexion, galleta){
    const codusu = texto(galleta ? galleta.identificador : null);
    const yo = await perfil(conexion, codusu, false);
    if(!yo.tipo && !yo.familia) return {rechazo:"no identificado"};
    if(yo.rol !== 'JEFATURA' && yo.rol !== 'ESPECIALISTA') return {rechazo:"sin permiso"};
    return {yo};
}

module.exports={
    ejecutar, texto, mesAnterior, leerMarcas, perfil, revisar, motivoComun, soloMarca, omitir,
    insertarAsignaciones, tomarMarcas, marcarConfirmado, enTransaccion, soloLectura,
    marcasPermitidas, quienPregunta
};
