const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, soloLectura, marcasPermitidas, quienPregunta} = require('../marcas/comun')
const {VENTA, UNIDADES, DESDE, donde, leerPeriodo} = require('../marcas/ventas')

/////Cobertura de clientes del grupo 25: a que clientes se les vendio cada marca en el mes.
/////
/////Que marcas ve cada uno es lo mismo que en cuota y reportes (el especialista las suyas, la
/////jefatura las asignadas de su familia), del mes en curso o de uno de los dos anteriores.
/////Que cuenta como venta: querys/marcas/ventas.js, lo mismo que la cuota.
/////
/////Un cliente "consumio" la marca si en el mes le quedaron unidades compradas (mas de 0 netas).
/////Un cliente que en el mes solo tuvo devoluciones aparece en la lista con unidades negativas,
/////pero no cuenta como cliente de la marca.

/////Columnas de /clientes, en el orden de la pantalla y del Excel
const COLUMNAS_CLIENTES = [
    {campo:'codcli',       titulo:'CODIGO'},
    {campo:'ruc',          titulo:'RUC'},
    {campo:'nombre',       titulo:'CLIENTE'},
    {campo:'unidades',     titulo:'UNIDADES'},
    {campo:'venta',        titulo:'VENTA US$ SIN IGV'},
    {campo:'comprobantes', titulo:'COMPROBANTES'},
    {campo:'ultimaCompra', titulo:'ULTIMA COMPRA'}
];

function redondear(n){ return n == null ? null : Math.round(n*100)/100; }

/////Venta por marca y cliente: [{codmar, codcli, ruc, nombre, unidades, venta, comprobantes, ultimaCompra}]
async function ventasPorCliente(conexion, codigos, anno, mes){
    if(codigos.length === 0) return [];
    const parametros = [
        {nombre:'anno',tipo:TYPES.Int,valor:anno},
        {nombre:'mes',tipo:TYPES.Int,valor:mes}
    ];
    const lista = codigos.map((c,i)=>{ parametros.push({nombre:`m${i}`,tipo:TYPES.Char,valor:c}); return `@m${i}`; }).join(',');
    const r = await ejecutar(conexion,
        `select p.codmar, rtrim(b.codcli), max(rtrim(b.ruccli)), max(rtrim(b.nomcli)),
                ${UNIDADES}, ${VENTA},
                count(distinct b.cdocu+b.ndocu), convert(char(10), max(b.fecha), 23)
         ${DESDE}
         where ${donde()} and p.codmar in (${lista})
         group by p.codmar, b.codcli`,
        parametros);
    return r.rows.map(f=>({
        codmar: texto(f[0].value), codcli: texto(f[1].value), ruc: texto(f[2].value), nombre: texto(f[3].value),
        unidades: f[4].value || 0, venta: redondear(f[5].value || 0),
        comprobantes: f[6].value, ultimaCompra: f[7].value
    }));
}

function resumir(filas){
    const compraron = filas.filter(f=>f.unidades > 0);
    return {
        clientes: compraron.length,
        unidades: filas.reduce((t,f)=>t + f.unidades, 0),
        venta: redondear(filas.reduce((t,f)=>t + f.venta, 0))
    };
}

async function contexto(conexion, galleta, cuerpo){
    const q = await quienPregunta(conexion, galleta);
    if(q.rechazo) return q;
    const periodo = leerPeriodo(cuerpo, q.yo);
    if(!periodo) return {rechazo:"periodo invalido"};
    const actual = periodo.anno === q.yo.anno && periodo.mes === q.yo.mes;
    return {yo:q.yo, periodo, actual, alcance:Object.assign({}, q.yo, periodo)};
}

/////GET /cobertura/marcas: cuantos clientes compro cada marca en el mes
let cobertura_marcas = (resolve,reject,conexion,galleta,cuerpo)=>{
    soloLectura(resolve, reject, conexion, 'cobertura marcas', async ()=>{
        const c = await contexto(conexion, galleta, cuerpo);
        if(c.rechazo) return c;

        const marcas = await marcasPermitidas(conexion, c.alcance, null);
        if(marcas.length === 0) return {rechazo: c.actual ? "sin marcas del mes" : "sin marcas en ese mes"};

        const filas = await ventasPorCliente(conexion, marcas.map(m=>m.codmar), c.periodo.anno, c.periodo.mes);
        const porMarca = {};
        filas.forEach(f=>(porMarca[f.codmar] = porMarca[f.codmar] || []).push(f));

        /////clientes distintos entre todas las marcas: un cliente que compro dos marcas cuenta una vez
        const distintos = new Set(filas.filter(f=>f.unidades > 0).map(f=>f.codcli));

        return {
            anno: c.periodo.anno, mes: c.periodo.mes, actual: c.actual, rol: c.yo.rol,
            marcas: marcas.map(m=>Object.assign(
                {codmar:m.codmar, abrmar:m.abrmar, nombre:m.nombre, familia:m.familia, dueno:m.dueno},
                resumir(porMarca[m.codmar] || []))),
            total: Object.assign(resumir(filas), {clientes: distintos.size})
        };
    });
}

/////GET /cobertura/clientes?codmar=0206: los clientes de una marca en el mes
let cobertura_clientes = (resolve,reject,conexion,galleta,cuerpo)=>{
    const codmar = texto(cuerpo ? cuerpo.codmar : null);
    if(!codmar || !/^[0-9]{4}$/.test(codmar)){ conexion.close(); return reject("codmar invalido"); }

    soloLectura(resolve, reject, conexion, 'cobertura clientes', async ()=>{
        const c = await contexto(conexion, galleta, cuerpo);
        if(c.rechazo) return c;

        const marca = (await marcasPermitidas(conexion, c.alcance, codmar))[0];
        if(!marca) return {rechazo:"marca no disponible"};

        const filas = (await ventasPorCliente(conexion, [codmar], c.periodo.anno, c.periodo.mes))
            .map(f=>({codcli:f.codcli, ruc:f.ruc, nombre:f.nombre, unidades:f.unidades, venta:f.venta,
                      comprobantes:f.comprobantes, ultimaCompra:f.ultimaCompra}))
            .sort((a,b)=>b.venta - a.venta || String(a.nombre).localeCompare(String(b.nombre)));

        return {
            anno: c.periodo.anno, mes: c.periodo.mes, actual: c.actual,
            marca: {codmar:marca.codmar, abrmar:marca.abrmar, nombre:marca.nombre, familia:marca.familia, dueno:marca.dueno},
            columnas: COLUMNAS_CLIENTES,
            clientes: filas,
            total: resumir(filas)
        };
    });
}

module.exports={cobertura_marcas, cobertura_clientes}
