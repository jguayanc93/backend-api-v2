const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, soloLectura, marcasPermitidas, quienPregunta} = require('../marcas/comun')
const {GLOSAS_COMPRA, ANNOS_KARDEX} = require('../../funciones/comunes/constantes')

/////Reportes por marca del grupo 25: stock, tiempo en almacen y lista de precios.
/////
/////Que marcas puede consultar cada uno (las del mes en curso):
/////  - especialista: las que tiene asignadas, las haya confirmado o no
/////  - jefatura: las asignadas de su familia, es decir las suyas y las de sus especialistas.
/////    Las marcas de su familia que nadie tiene no entran.
/////Sin marcas en el mes no ve nada: "sin marcas del mes".
/////
/////Las filas salen con nombres, no por posicion, y cada informe declara sus columnas para
/////que la pantalla y el Excel usen los mismos titulos.

const COLUMNAS = {
    stock: [
        {campo:'codi',        titulo:'CODIGO'},
        {campo:'codf',        titulo:'CODF'},
        {campo:'descripcion', titulo:'DESCRIPCION'},
        {campo:'partNumber',  titulo:'PART NUMBER'},
        {campo:'familia',     titulo:'FAMILIA'},
        {campo:'principal',   titulo:'PRINCIPAL'},
        {campo:'mym',         titulo:'M&M'},
        {campo:'piura',       titulo:'PIURA'},
        {campo:'chorrillos',  titulo:'CHORRILLOS'},
        {campo:'total',       titulo:'TOTAL'},
        {campo:'ordenado',    titulo:'ORDENADO'}
    ],
    tiempo: [
        {campo:'codi',         titulo:'CODIGO'},
        {campo:'codf',         titulo:'CODF'},
        {campo:'descripcion',  titulo:'DESCRIPCION'},
        {campo:'partNumber',   titulo:'PART NUMBER'},
        {campo:'familia',      titulo:'FAMILIA'},
        {campo:'stock',        titulo:'STOCK'},
        {campo:'ultimaCompra', titulo:'ULTIMA COMPRA'},
        {campo:'dias',         titulo:'DIAS'}
    ],
    precios: [
        {campo:'codi',            titulo:'CODIGO'},
        {campo:'codf',            titulo:'CODF'},
        {campo:'descripcion',     titulo:'DESCRIPCION'},
        {campo:'partNumber',      titulo:'PART NUMBER'},
        {campo:'familia',         titulo:'FAMILIA'},
        {campo:'costoPrincipal',  titulo:'COSTO PRINCIPAL US$'},
        {campo:'ventaPrincipal',  titulo:'VALOR VENTA PRINCIPAL US$'},
        {campo:'costoMym',        titulo:'COSTO M&M US$'},
        {campo:'ventaMym',        titulo:'VALOR VENTA M&M US$'}
    ],
    guias: [
        {campo:'fecha',            titulo:'FECHA'},
        {campo:'tipo',             titulo:'TIPO'},
        {campo:'numero',           titulo:'NUMERO'},
        {campo:'estado',           titulo:'ESTADO'},
        {campo:'motivo',           titulo:'MOTIVO'},
        {campo:'almacen',          titulo:'ALMACEN'},
        {campo:'cliente',          titulo:'CLIENTE'},
        {campo:'referencia',       titulo:'DOC. REFERENCIA'},
        {campo:'numeroReferencia', titulo:'NRO. REFERENCIA'},
        {campo:'codi',             titulo:'CODIGO'},
        {campo:'codf',             titulo:'CODF'},
        {campo:'descripcion',      titulo:'DESCRIPCION'},
        {campo:'cantidad',         titulo:'CANTIDAD'}
    ]
};

/////Guias: solo guias de remision (09) y notas de despacho del local (51), sin las anuladas.
const TIPOS_GUIA = {'09':'GUIA REMISION', '51':'NOTA DE DESPACHO'};
/////flag de mst01gui: 0 = la guia existe pero aun no tiene salida en el kardex; 1 = ya salio
const ESTADOS_GUIA = {'0':'PENDIENTE DE SALIDA', '1':'CON SALIDA'};
/////rango maximo de fechas que se puede pedir: con tres meses la marca con mas movimiento
/////(HP) son unas 12 000 lineas
const MAX_DIAS_GUIAS = 92;

/////stock disponible de un almacen: fisico menos lo separado para venta y lo pedido
function disponible(a){
    return `(CAST(ISNULL(${a}.stoc,0) as int)-(CAST(ISNULL(${a}.svta,0) as int)+CAST(ISNULL(${a}.pedi,0) as int)))`;
}
const STOCK_TOTAL = `(${disponible('b')}+${disponible('c')}+${disponible('d')}+${disponible('e')})`;
/////los cuatro almacenes: 01 principal (prd0101), 08 M&M, 15 Piura, 16 Chorrillos
const ALMACENES = `from prd0101 b
     left join tbl01fam f on f.codfam=LEFT(b.codi,2)
     left join prd0108 c on c.codi=b.codi
     left join prd0115 d on d.codi=b.codi
     left join prd0116 e on e.codi=b.codi`;

/////GET /reporte/marca: la lista de marcas que puede consultar
let reporte_marcas_mes = (resolve,reject,conexion,galleta)=>{
    soloLectura(resolve, reject, conexion, 'reporte marcas', async ()=>{
        const q = await quienPregunta(conexion, galleta);
        if(q.rechazo) return q;
        const marcas = await marcasPermitidas(conexion, q.yo, null);
        if(marcas.length === 0) return {rechazo:"sin marcas del mes"};
        return {anno:q.yo.anno, mes:q.yo.mes, rol:q.yo.rol, marcas:marcas};
    });
}

/////Los años de kardex que existen, del actual hacia atras
async function tablasKardex(conexion, anno){
    const nombres = [];
    for(let i=0;i<ANNOS_KARDEX;i++) nombres.push(`dtl_kdd_cons_${anno-i}`);
    const r = await ejecutar(conexion,
        `select name from sys.tables where lower(name) in (${nombres.map(n=>`'${n}'`).join(',')})`, []);
    const existen = r.rows.map(f=>String(f[0].value).toLowerCase());
    return nombres.filter(n=>existen.includes(n));
}

const CONSULTAS = {
    stock: async (conexion)=>({
        sql: `select rtrim(b.codi), rtrim(b.codf), rtrim(b.descr), rtrim(b.Usr_001), rtrim(f.nomfam),
                     ${disponible('b')}, ${disponible('c')}, ${disponible('d')}, ${disponible('e')}, ${STOCK_TOTAL},
                     CAST(ISNULL(b.orde,0) as int)+CAST(ISNULL(c.orde,0) as int)+CAST(ISNULL(d.orde,0) as int)+CAST(ISNULL(e.orde,0) as int)
              ${ALMACENES}
              where b.estado=1 and b.codmar=@codmar
              order by b.descr`,
        fila: (v)=>({codi:v[0], codf:v[1], descripcion:v[2], partNumber:v[3], familia:v[4],
                     principal:v[5], mym:v[6], piura:v[7], chorrillos:v[8], total:v[9], ordenado:v[10]})
    }),

    /////solo productos con stock. Primero los que no tienen compra en los años revisados,
    /////luego del mas antiguo al mas reciente.
    tiempo: async (conexion, yo)=>{
        const tablas = await tablasKardex(conexion, yo.anno);
        const glosas = GLOSAS_COMPRA.map(g=>`'${g}'`).join(',');
        const compras = tablas.length === 0
            ? `select cast(null as varchar(20)) codi, cast(null as datetime) fecha where 1=0`
            : tablas.map(t=>`select codi, fecha from ${t} where tmov='E' and codglo in (${glosas})
                             and codi in (select codi from prd0101 where estado=1 and codmar=@codmar)`).join(' union all ');
        return {
            sql: `with ultima as (select codi, max(fecha) fecha from (${compras}) k group by codi)
                  select rtrim(b.codi), rtrim(b.codf), rtrim(b.descr), rtrim(b.Usr_001), rtrim(f.nomfam),
                         s.total, convert(char(10), u.fecha, 23), datediff(day, u.fecha, getdate())
                  ${ALMACENES}
                  cross apply (select ${STOCK_TOTAL} total) s
                  left join ultima u on u.codi=b.codi
                  where b.estado=1 and b.codmar=@codmar and s.total>0
                  order by case when u.fecha is null then 0 else 1 end, u.fecha, b.descr`,
            fila: (v)=>({codi:v[0], codf:v[1], descripcion:v[2], partNumber:v[3], familia:v[4],
                         stock:v[5], ultimaCompra:v[6], dias:v[7]}),
            desde: tablas.length ? Number(tablas[tablas.length-1].slice(-4)) : null
        };
    },

    /////en dolares y sin IGV. Los precios cambian por almacen: M&M va aparte, y en null si
    /////el producto no esta dado de alta en M&M
    precios: async ()=>({
        sql: `select rtrim(b.codi), rtrim(b.codf), rtrim(b.descr), rtrim(b.Usr_001), rtrim(f.nomfam),
                     b.pcus, b.vvus, c.pcus, c.vvus
              ${ALMACENES}
              where b.estado=1 and b.codmar=@codmar
              order by b.descr`,
        fila: (v)=>({codi:v[0], codf:v[1], descripcion:v[2], partNumber:v[3], familia:v[4],
                     costoPrincipal:v[5], ventaPrincipal:v[6], costoMym:v[7], ventaMym:v[8]})
    }),

    /////una fila por cada producto de la marca dentro de cada guia: si la guia lleva tres
    /////marcas, solo salen las lineas de esta. Las mas recientes primero.
    guias: async (conexion, yo, rango)=>({
        sql: `select convert(char(10), g.fecha, 23), rtrim(g.cdocu), rtrim(g.ndocu), rtrim(g.flag),
                     rtrim(s.nomglo), rtrim(g.codalm), rtrim(g.nomcli),
                     rtrim(t.nomdoc), nullif(rtrim(g.nrefe),''),
                     rtrim(d.codi), rtrim(d.codf), rtrim(d.descr), d.cant
              from mst01gui g
              join dtl01gui d on d.cdocu=g.cdocu and d.ndocu=g.ndocu
              join prd0101 p on p.codi=d.codi
              left join tbl01gls s on s.codglo=g.codglo
              left join tbl01doc t on t.cdocu=g.crefe
              where g.cdocu in ('09','51') and isnull(g.flag,'')<>'*'
                and p.codmar=@codmar
                and g.fecha>=@desde and g.fecha<dateadd(day,1,@hasta)
              order by g.fecha desc, g.ndocu, d.item`,
        parametros: [{nombre:'desde',tipo:TYPES.Date,valor:rango.desde},
                     {nombre:'hasta',tipo:TYPES.Date,valor:rango.hasta}],
        fila: (v)=>({fecha:v[0], tipo:TIPOS_GUIA[v[1]] || v[1], numero:v[2],
                     estado:ESTADOS_GUIA[v[3]] || v[3], motivo:v[4], almacen:v[5], cliente:v[6],
                     referencia:v[7], numeroReferencia:v[8],
                     codi:v[9], codf:v[10], descripcion:v[11], cantidad:v[12]})
    })
};

/////"AAAA-MM-DD" valida -> Date en UTC, o null
function leerFecha(valor){
    if(typeof valor !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(valor.trim())) return null;
    const [a,m,d] = valor.trim().split('-').map(Number);
    const f = new Date(Date.UTC(a,m-1,d));
    return (f.getUTCFullYear()===a && f.getUTCMonth()===m-1 && f.getUTCDate()===d) ? f : null;
}
function aTexto(f){ return f.toISOString().slice(0,10); }

/////El periodo de guias. Sin fechas: el mes en curso completo. Devuelve {desde,hasta} o null.
function leerRango(cuerpo, anno, mes){
    const pideDesde = cuerpo && cuerpo.desde != null && cuerpo.desde !== '';
    const pideHasta = cuerpo && cuerpo.hasta != null && cuerpo.hasta !== '';
    const desde = pideDesde ? leerFecha(cuerpo.desde) : new Date(Date.UTC(anno, mes-1, 1));
    const hasta = pideHasta ? leerFecha(cuerpo.hasta) : new Date(Date.UTC(anno, mes, 0));
    if(!desde || !hasta || desde > hasta) return null;
    if((hasta - desde) / 86400000 > MAX_DIAS_GUIAS) return null;
    return {desde, hasta};
}

/////POST /reporte/marca/<informe>: cuerpo {"codmar":"0008"}
function reporte_informe(informe){
    return (resolve,reject,conexion,galleta,cuerpo)=>{
        const codmar = texto(cuerpo ? cuerpo.codmar : null);
        if(!codmar || !/^[0-9]{4}$/.test(codmar)){ conexion.close(); return reject("codmar invalido"); }

        soloLectura(resolve, reject, conexion, `reporte ${informe}`, async ()=>{
            const q = await quienPregunta(conexion, galleta);
            if(q.rechazo) return q;
            const marca = (await marcasPermitidas(conexion, q.yo, codmar))[0];
            if(!marca) return {rechazo:"marca no disponible"};

            let rango = null;
            if(informe === 'guias'){
                rango = leerRango(cuerpo, q.yo.anno, q.yo.mes);
                if(!rango) return {rechazo:"rango invalido"};
            }

            const consulta = await CONSULTAS[informe](conexion, q.yo, rango);
            const r = await ejecutar(conexion, consulta.sql,
                [{nombre:'codmar',tipo:TYPES.Char,valor:codmar}].concat(consulta.parametros || []));

            const filas = r.rows.map(f=>consulta.fila(f.map(c=>c.value)));
            const respuesta = {
                informe: informe,
                marca: {codmar:marca.codmar, abrmar:marca.abrmar, nombre:marca.nombre, familia:marca.familia},
                anno: q.yo.anno, mes: q.yo.mes,
                generado: new Date().toISOString(),
                columnas: COLUMNAS[informe],
                filas: filas
            };
            if(informe === 'tiempo') respuesta.kardexDesde = consulta.desde;
            if(rango){ respuesta.desde = aTexto(rango.desde); respuesta.hasta = aTexto(rango.hasta); }
            return respuesta;
        });
    };
}

module.exports={
    reporte_marcas_mes,
    reporte_stock_marca: reporte_informe('stock'),
    reporte_tiempo_marca: reporte_informe('tiempo'),
    reporte_precios_marca: reporte_informe('precios'),
    reporte_guias_marca: reporte_informe('guias')
}
