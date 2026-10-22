const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, perfil, soloLectura, enTransaccion, marcasPermitidas, quienPregunta} = require('../marcas/comun')
const {VENTA, COSTO, UNIDADES, DESDE, donde, leerPeriodo} = require('../marcas/ventas')

/////Cuota por marca del grupo 25 (mes en curso).
/////
/////La meta de cada marca la pone su dueño (el especialista, o la jefatura para las suyas),
/////solo si ya confirmo sus marcas del mes, y la puede corregir las veces que haga falta. Se
/////mide en monto, rentabilidad (en US$ y/o en %) y unidades; cualquiera puede quedar sin meta.
/////
/////Que marcas ve cada uno es lo mismo que en reportes: el especialista las suyas, la jefatura
/////las asignadas de su familia (las suyas y las de sus especialistas).
/////
/////El avance se calcula en el momento con las facturas del mes, con las reglas de
/////querys/marcas/ventas.js (las mismas que la cobertura de clientes).

function redondear(n, d){ if(n == null || !isFinite(n)) return null; const f = Math.pow(10, d==null?2:d); return Math.round(n*f)/f; }
function porcentaje(parte, todo){ return (todo == null || todo === 0 || parte == null) ? null : redondear(parte / todo * 100); }

/////Avance de varias marcas en el mes: {codmar: {venta, costo, unidades}}
async function avanceDeMarcas(conexion, codigos, anno, mes){
    const resultado = {};
    codigos.forEach(c=>resultado[c] = {venta:0, costo:0, unidades:0});
    if(codigos.length === 0) return resultado;

    const parametros = [
        {nombre:'anno',tipo:TYPES.Int,valor:anno},
        {nombre:'mes',tipo:TYPES.Int,valor:mes}
    ];
    const lista = codigos.map((c,i)=>{ parametros.push({nombre:`m${i}`,tipo:TYPES.Char,valor:c}); return `@m${i}`; }).join(',');

    const r = await ejecutar(conexion,
        `select p.codmar, ${VENTA}, ${COSTO}, ${UNIDADES}
         ${DESDE}
         where ${donde()} and p.codmar in (${lista})
         group by p.codmar`,
        parametros);

    r.rows.forEach(f=>{
        resultado[texto(f[0].value)] = {venta:f[1].value || 0, costo:f[2].value || 0, unidades:f[3].value || 0};
    });
    return resultado;
}

/////Las metas del mes de esas marcas: {codmar: {monto, margen, margenPct, unidades, actualizado}}
async function metasDeMarcas(conexion, codigos, anno, mes){
    const resultado = {};
    if(codigos.length === 0) return resultado;
    const parametros = [
        {nombre:'anno',tipo:TYPES.Int,valor:anno},
        {nombre:'mes',tipo:TYPES.Int,valor:mes}
    ];
    const lista = codigos.map((c,i)=>{ parametros.push({nombre:`m${i}`,tipo:TYPES.Char,valor:c}); return `@m${i}`; }).join(',');
    const r = await ejecutar(conexion,
        `select codmar, meta_monto, meta_margen, meta_margen_pct, meta_unidades, actualizado
         from tbl01_api_marcas_meta where anno=@anno and mes=@mes and codmar in (${lista})`,
        parametros);
    r.rows.forEach(f=>{
        resultado[texto(f[0].value)] = {monto:f[1].value, margen:f[2].value, margenPct:f[3].value,
                                       unidades:f[4].value, actualizado:f[5].value};
    });
    return resultado;
}

function armarAvance(a){
    const margen = a.venta - a.costo;
    return {venta:redondear(a.venta), costo:redondear(a.costo), margen:redondear(margen),
            margenPct:porcentaje(margen, a.venta), unidades:a.unidades};
}

/////Cuanto de cada meta se lleva, en %. null donde no hay meta.
function armarCumplimiento(meta, avance){
    if(!meta) return {monto:null, margen:null, margenPct:null, unidades:null};
    return {
        monto: porcentaje(avance.venta, meta.monto),
        margen: porcentaje(avance.margen, meta.margen),
        margenPct: porcentaje(avance.margenPct, meta.margenPct),
        unidades: porcentaje(avance.unidades, meta.unidades)
    };
}

/////Para cada medida, que parte del avance se compara con su meta
const MEDIDAS = [
    {meta:'monto',    avance:'venta'},
    {meta:'margen',   avance:'margen'},
    {meta:'unidades', avance:'unidades'}
];

/////Suma de varias marcas (el total, o el general de cada dueño).
/////  - avance: el de TODAS las marcas
/////  - cumplimiento de cada medida: solo con las marcas que tienen meta en esa medida. Si una
/////    marca sin meta entrara en la cuenta, su venta inflaria el % (lo detecto el frontend)
/////  - conMeta: cuantas marcas tienen meta en cada medida
/////  - la meta de margen en % no se suma: no tiene sentido sumar porcentajes
/////Con actual=false (un mes ya cerrado) no hay proyeccion: el mes ya termino.
function sumar(filas, dias, actual){
    const meta = {monto:null, margen:null, unidades:null};
    const conMeta = {monto:0, margen:0, unidades:0};
    const avanceConMeta = {monto:0, margen:0, unidades:0};
    const bruto = {venta:0, costo:0, unidades:0};
    filas.forEach(f=>{
        MEDIDAS.forEach(m=>{
            if(f.meta && f.meta[m.meta] != null){
                meta[m.meta] = (meta[m.meta]||0) + Number(f.meta[m.meta]);
                conMeta[m.meta]++;
                avanceConMeta[m.meta] += f.avance[m.avance] || 0;
            }
        });
        bruto.venta += f.avance.venta || 0;
        bruto.costo += f.avance.costo || 0;
        bruto.unidades += f.avance.unidades || 0;
    });
    const avance = armarAvance(bruto);
    meta.monto = redondear(meta.monto); meta.margen = redondear(meta.margen);
    return {
        marcas: filas.length,
        conMeta: conMeta,
        meta: meta,
        avance: avance,
        cumplimiento: {
            monto: porcentaje(avanceConMeta.monto, meta.monto),
            margen: porcentaje(avanceConMeta.margen, meta.margen),
            unidades: porcentaje(avanceConMeta.unidades, meta.unidades)
        },
        proyeccion: actual ? {
            venta: proyectar(avance.venta, dias),
            cumplimiento: {monto: porcentaje(proyectar(avanceConMeta.monto, dias), meta.monto)}
        } : null
    };
}

/////a este ritmo, cuanto se vendera en el mes
function proyectar(venta, dias){ return redondear(venta / dias.transcurridos * dias.mes); }

/////Dias del mes consultado. En el mes en curso, los que pasaron (contando hoy) y los que
/////faltan; en un mes cerrado, todos pasaron.
async function diasDelMes(conexion, anno, mes, actual){
    const r = await ejecutar(conexion, "select day(eomonth(datefromparts(@anno,@mes,1))), day(getdate())",
        [{nombre:'anno',tipo:TYPES.Int,valor:anno},{nombre:'mes',tipo:TYPES.Int,valor:mes}]);
    const total = r.rows[0][0].value, transcurridos = actual ? r.rows[0][1].value : total;
    return {mes:total, transcurridos:transcurridos, restantes:total - transcurridos};
}

function mesAnteriorDe(anno, mes){ return mes === 1 ? {anno:anno-1, mes:12} : {anno, mes:mes-1}; }

/////GET /cuota/marcas, o GET /cuota/marcas?anno=2026&mes=9 para un mes anterior.
/////Un mes anterior se ve como fue: las marcas que estaban asignadas ese mes, con el dueño de
/////ese mes, su meta y su avance de ese mes. Es solo lectura y no tiene proyeccion.
let cuota_marcas_ver = (resolve,reject,conexion,galleta,cuerpo)=>{
    soloLectura(resolve, reject, conexion, 'cuota marcas', async ()=>{
        const q = await quienPregunta(conexion, galleta);
        if(q.rechazo) return q;
        const yo = q.yo;

        const periodo = leerPeriodo(cuerpo, yo);
        if(!periodo) return {rechazo:"periodo invalido"};
        const actual = periodo.anno === yo.anno && periodo.mes === yo.mes;

        /////las marcas de ese mes: marcasPermitidas usa anno y mes de "yo"
        const marcas = await marcasPermitidas(conexion, Object.assign({}, yo, periodo), null);
        if(marcas.length === 0) return {rechazo: actual ? "sin marcas del mes" : "sin marcas en ese mes"};

        const codigos = marcas.map(m=>m.codmar);
        const avances = await avanceDeMarcas(conexion, codigos, periodo.anno, periodo.mes);
        const metas = await metasDeMarcas(conexion, codigos, periodo.anno, periodo.mes);
        const antes = mesAnteriorDe(periodo.anno, periodo.mes);
        const metasAntes = await metasDeMarcas(conexion, codigos, antes.anno, antes.mes);
        const dias = await diasDelMes(conexion, periodo.anno, periodo.mes, actual);
        const yoConfirme = yo.confirmadoEn != null;

        const filas = marcas.map(m=>{
            const meta = metas[m.codmar] || null;
            const avance = armarAvance(avances[m.codmar]);
            return {
                codmar: m.codmar, abrmar: m.abrmar, nombre: m.nombre, familia: m.familia,
                dueno: m.dueno,
                confirmada: m.confirmada,
                /////si hoy se trabaja: en un mes pasado avisa que una marca que se tuvo ya no
                trabajadaHoy: m.trabajadaHoy,
                /////solo el dueño, solo si ya confirmo sus marcas, y solo en el mes en curso
                puedoFijarMeta: actual && m.dueno.soyYo && yoConfirme,
                meta: meta,
                /////la meta que tuvo la marca el mes anterior (la pusiera quien la pusiera): para
                /////precargar el formulario de la meta. null si no tuvo
                metaMesAnterior: metasAntes[m.codmar] || null,
                avance: avance,
                cumplimiento: armarCumplimiento(meta, avance),
                /////a este ritmo, cuanto se vendera en el mes, y que % de la meta de monto seria.
                /////En un mes cerrado no hay proyeccion
                proyeccion: actual ? {venta: proyectar(avance.venta, dias),
                             cumplimiento: {monto: porcentaje(proyectar(avance.venta, dias), meta ? meta.monto : null)}} : null
            };
        });

        const respuesta = {anno:periodo.anno, mes:periodo.mes, actual:actual, rol:yo.rol, dias:dias,
                           marcas:filas, total:sumar(filas, dias, actual)};

        /////la jefatura ve ademas el general de cada uno: sus especialistas y ella misma
        if(yo.rol === 'JEFATURA'){
            const grupos = {};
            filas.forEach(f=>{ (grupos[f.dueno.codusu] = grupos[f.dueno.codusu] || {dueno:f.dueno, filas:[]}).filas.push(f); });
            respuesta.porDueno = Object.values(grupos)
                .map(g=>Object.assign({dueno:g.dueno}, sumar(g.filas, dias, actual)))
                .sort((a,b)=>String(a.dueno.nombre).localeCompare(String(b.dueno.nombre)));
        }
        return respuesta;
    });
}

/////Lee un campo de meta del cuerpo. undefined = no se manda (se conserva lo anterior);
/////null o "" = se borra esa meta; si no, un numero MAYOR QUE CERO. {valor} o {error}.
/////Una meta de 0 no existe: para quitar una meta se manda null. Asi el cumplimiento nunca
/////divide entre cero ni se confunde "sin meta" con "meta cero".
function leerMeta(cuerpo, campo, entero, maximo){
    if(!cuerpo || !(campo in cuerpo)) return {valor:undefined};
    const v = cuerpo[campo];
    if(v === null || v === '') return {valor:null};
    const n = Number(v);
    if(!isFinite(n) || n <= 0 || (entero && !Number.isInteger(n)) || (maximo != null && n > maximo)) return {error:true};
    return {valor: entero ? n : redondear(n)};
}

/////POST /cuota/marcas/meta: {"codmar":"0008","monto":50000,"margen":7000,"margenPct":12.5,"unidades":3000}
let cuota_marcas_fijar = (resolve,reject,conexion,galleta,cuerpo)=>{
    const codusu = texto(galleta ? galleta.identificador : null);
    const codmar = texto(cuerpo ? cuerpo.codmar : null);
    if(!codmar || !/^[0-9]{4}$/.test(codmar)){ conexion.close(); return reject("codmar invalido"); }

    const campos = {
        monto: leerMeta(cuerpo,'monto',false),
        margen: leerMeta(cuerpo,'margen',false),
        margenPct: leerMeta(cuerpo,'margenPct',false,100),
        unidades: leerMeta(cuerpo,'unidades',true)
    };
    if(Object.values(campos).some(c=>c.error)){ conexion.close(); return reject("meta invalida"); }
    if(Object.values(campos).every(c=>c.valor === undefined)){ conexion.close(); return reject("meta vacia"); }

    enTransaccion(resolve, reject, conexion, 'cuota marcas meta', async ()=>{
        const yo = await perfil(conexion, codusu, false);
        if(!yo.tipo && !yo.familia) return {rechazo:"no identificado"};
        if(yo.rol !== 'JEFATURA' && yo.rol !== 'ESPECIALISTA') return {rechazo:"sin permiso"};

        const duena = await ejecutar(conexion,
            "select rtrim(codusu) from tbl01_api_marcas_asignadas where anno=@anno and mes=@mes and codmar=@codmar",
            [{nombre:'anno',tipo:TYPES.Int,valor:yo.anno},{nombre:'mes',tipo:TYPES.Int,valor:yo.mes},
             {nombre:'codmar',tipo:TYPES.Char,valor:codmar}]);
        if(duena.rows.length === 0 || duena.rows[0][0].value !== codusu) return {rechazo:"meta solo del dueno"};
        if(!yo.confirmadoEn) return {rechazo:"marcas sin confirmar"};

        const previa = await ejecutar(conexion,
            `select meta_monto, meta_margen, meta_margen_pct, meta_unidades
             from tbl01_api_marcas_meta with (updlock, holdlock) where anno=@anno and mes=@mes and codmar=@codmar`,
            [{nombre:'anno',tipo:TYPES.Int,valor:yo.anno},{nombre:'mes',tipo:TYPES.Int,valor:yo.mes},
             {nombre:'codmar',tipo:TYPES.Char,valor:codmar}]);
        const antes = previa.rows.length ? previa.rows[0].map(c=>c.value) : [null,null,null,null];
        const elegir = (c,i)=> c.valor === undefined ? antes[i] : c.valor;
        const nueva = {monto:elegir(campos.monto,0), margen:elegir(campos.margen,1),
                       margenPct:elegir(campos.margenPct,2), unidades:elegir(campos.unidades,3)};

        const parametros = [
            {nombre:'anno',tipo:TYPES.Int,valor:yo.anno},{nombre:'mes',tipo:TYPES.Int,valor:yo.mes},
            {nombre:'codmar',tipo:TYPES.Char,valor:codmar},{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu},
            {nombre:'monto',tipo:TYPES.Decimal,valor:nueva.monto,opciones:{precision:14,scale:2}},
            {nombre:'margen',tipo:TYPES.Decimal,valor:nueva.margen,opciones:{precision:14,scale:2}},
            {nombre:'pct',tipo:TYPES.Decimal,valor:nueva.margenPct,opciones:{precision:6,scale:2}},
            {nombre:'unidades',tipo:TYPES.Int,valor:nueva.unidades}
        ];
        if(previa.rows.length){
            await ejecutar(conexion,
                `update tbl01_api_marcas_meta set codusu=@codusu, meta_monto=@monto, meta_margen=@margen,
                        meta_margen_pct=@pct, meta_unidades=@unidades, actualizado=getdate()
                 where anno=@anno and mes=@mes and codmar=@codmar`, parametros);
        }else{
            await ejecutar(conexion,
                `insert into tbl01_api_marcas_meta(anno,mes,codmar,codusu,meta_monto,meta_margen,meta_margen_pct,meta_unidades)
                 values(@anno,@mes,@codmar,@codusu,@monto,@margen,@pct,@unidades)`, parametros);
        }

        return {codmar:codmar, anno:yo.anno, mes:yo.mes, nueva:previa.rows.length === 0,
                meta:{monto:nueva.monto, margen:nueva.margen, margenPct:nueva.margenPct, unidades:nueva.unidades}};
    });
}

module.exports={cuota_marcas_ver, cuota_marcas_fijar, avanceDeMarcas}
