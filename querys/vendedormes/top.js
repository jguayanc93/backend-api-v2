const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, soloLectura, marcasPermitidas, quienPregunta} = require('../marcas/comun')
const {VENTA, UNIDADES, DESDE, dondeVenta, leerPeriodo} = require('../marcas/ventas')

/////Vendedor del mes (grupo 25): de cada marca, los 3 vendedores del grupo 20 (cobertura o
/////cartera) que mas la vendieron en el mes.
/////
/////  - que marcas: las mismas que en cuota, reportes y cobertura (el especialista las suyas, la
/////    jefatura las asignadas de su familia)
/////  - que mes: el mes en curso o el anterior, nada mas
/////  - que cuenta como venta: querys/marcas/ventas.js, lo mismo que la cuota
/////  - de quien es una venta: del vendedor de la factura (codven_usu), como en la cuota del
/////    grupo 20. Solo vendedores del grupo 20; las ventas de otros grupos no entran en el ranking
/////    ni en el total
/////  - de cada uno: venta, participacion en el total del grupo 20 en esa marca, unidades,
/////    clientes y como estaba el mes anterior

const MESES_ATRAS = 1;
const TOP = 3;
const GRUPO_VENDEDORES = '20';

function redondear(n){ return n == null ? null : Math.round((n + Number.EPSILON) * 100) / 100; }
/////Orden del ranking. Con la misma venta (al centimo) gana el de mas unidades, luego el de mas
/////clientes y, si todo empata, el codigo de vendedor: el orden nunca cambia entre dos lecturas.
function ordenRanking(a, b){
    return (redondear(b.venta) - redondear(a.venta)) || (b.unidades - a.unidades) ||
           (b.clientes - a.clientes) || String(a.codven).localeCompare(String(b.codven));
}

function mesAnteriorDe(anno, mes){ return mes === 1 ? {anno:anno-1, mes:12} : {anno, mes:mes-1}; }
function inicioDe(anno, mes){ return `${anno}${String(mes).padStart(2,'0')}01`; }

/////Venta por marca y vendedor del grupo 20, en el mes pedido y en el anterior.
/////{ "AAAA-M": { codmar: [ {codven, venta, unidades, clientes} ...ordenados por venta] } }
async function ventasPorVendedor(conexion, codigos, periodo){
    const antes = mesAnteriorDe(periodo.anno, periodo.mes);
    const despues = periodo.mes === 12 ? {anno:periodo.anno+1, mes:1} : {anno:periodo.anno, mes:periodo.mes+1};
    const parametros = [
        {nombre:'desde',tipo:TYPES.VarChar,valor:inicioDe(antes.anno, antes.mes)},
        {nombre:'hasta',tipo:TYPES.VarChar,valor:inicioDe(despues.anno, despues.mes)},
        {nombre:'grupo',tipo:TYPES.VarChar,valor:GRUPO_VENDEDORES}
    ];
    const lista = codigos.map((c,i)=>{ parametros.push({nombre:`m${i}`,tipo:TYPES.Char,valor:c}); return `@m${i}`; }).join(',');
    const r = await ejecutar(conexion,
        `select year(b.fecha), month(b.fecha), p.codmar, rtrim(b.codven_usu),
                ${VENTA}, ${UNIDADES}, count(distinct b.codcli)
         ${DESDE}
         where ${dondeVenta()} and b.fecha>=@desde and b.fecha<@hasta and p.codmar in (${lista})
           and exists(select 1 from fcu0000 u where rtrim(u.codven)=rtrim(b.codven_usu) and rtrim(u.codgru)=@grupo)
         group by year(b.fecha), month(b.fecha), p.codmar, b.codven_usu`,
        parametros);

    const resultado = {};
    r.rows.forEach(f=>{
        const v = f.map(c=>c.value);
        const clave = `${v[0]}-${v[1]}`, codmar = texto(v[2]);
        const marcas = (resultado[clave] = resultado[clave] || {});
        (marcas[codmar] = marcas[codmar] || []).push({codven:texto(v[3]), venta:v[4] || 0, unidades:v[5] || 0, clientes:v[6]});
    });
    Object.values(resultado).forEach(marcas=>Object.values(marcas).forEach(l=>l.sort(ordenRanking)));
    return resultado;
}

/////El ultimo dia del mes con alguna factura o boleta registrada: a principio de mes el top es de
/////pocos dias, y la pantalla tiene que poder decirlo. null si el mes no tiene ventas.
async function ventasHasta(conexion, periodo){
    const r = await ejecutar(conexion,
        `select convert(char(10), max(b.fecha), 23) from mst01fac b
         where b.flag<>'*' and b.cdocu in ('01','03') and year(b.fecha)=@anno and month(b.fecha)=@mes`,
        [{nombre:'anno',tipo:TYPES.Int,valor:periodo.anno},{nombre:'mes',tipo:TYPES.Int,valor:periodo.mes}]);
    return r.rows[0][0].value || null;
}

/////Nombre y tipo (COBERTURA / CARTERA) de los vendedores
async function datosVendedores(conexion, codvens){
    if(codvens.length === 0) return {};
    const parametros = [];
    const lista = codvens.map((c,i)=>{ parametros.push({nombre:`v${i}`,tipo:TYPES.VarChar,valor:c}); return `@v${i}`; }).join(',');
    const r = await ejecutar(conexion,
        `select x.codven,
                (select top 1 rtrim(u.nomusu) from fcu0000 u where rtrim(u.codven)=x.codven),
                (select top 1 rtrim(d.diferenciador) from tbl_api_vendedores_diferenciador d where rtrim(d.codven)=x.codven)
         from (values ${codvens.map((c,i)=>`(@v${i})`).join(',')}) x(codven)`, parametros);
    const resultado = {};
    r.rows.forEach(f=>{ resultado[texto(f[0].value)] = {nombre:texto(f[1].value), tipo:texto(f[2].value)}; });
    return resultado;
}

/////GET /vendedormes/top?anno=2026&mes=9
let vendedormes_top = (resolve,reject,conexion,galleta,cuerpo)=>{
    soloLectura(resolve, reject, conexion, 'vendedor del mes', async ()=>{
        const q = await quienPregunta(conexion, galleta);
        if(q.rechazo) return q;
        const periodo = leerPeriodo(cuerpo, q.yo, MESES_ATRAS);
        if(!periodo) return {rechazo:"mes no disponible"};
        const actual = periodo.anno === q.yo.anno && periodo.mes === q.yo.mes;

        const marcas = await marcasPermitidas(conexion, Object.assign({}, q.yo, periodo), null);
        if(marcas.length === 0) return {rechazo: actual ? "sin marcas del mes" : "sin marcas en ese mes"};

        const ventas = await ventasPorVendedor(conexion, marcas.map(m=>m.codmar), periodo);
        const hasta = await ventasHasta(conexion, periodo);
        const antes = mesAnteriorDe(periodo.anno, periodo.mes);
        const deEste = ventas[`${periodo.anno}-${periodo.mes}`] || {};
        const delAnterior = ventas[`${antes.anno}-${antes.mes}`] || {};

        const codvens = new Set();
        marcas.forEach(m=>(deEste[m.codmar] || []).slice(0, TOP).forEach(v=>codvens.add(v.codven)));
        const datos = await datosVendedores(conexion, [...codvens]);

        return {
            anno: periodo.anno, mes: periodo.mes, actual: actual, rol: q.yo.rol,
            /////el ultimo dia del mes con ventas registradas (de todas las marcas), AAAA-MM-DD
            ventasHasta: hasta,
            marcas: marcas.map(m=>{
                /////solo vendedores con venta neta mayor que 0: el que en el mes devolvio mas de lo que
                /////vendio no entra en el ranking, ni en el total, ni en la participacion
                const lista = (deEste[m.codmar] || []).filter(v=>redondear(v.venta) > 0);
                const anterior = (delAnterior[m.codmar] || []).filter(v=>redondear(v.venta) > 0);
                const totalVenta = lista.reduce((t,v)=>t + v.venta, 0);
                return {
                    codmar: m.codmar, abrmar: m.abrmar, nombre: m.nombre, familia: m.familia, dueno: m.dueno,
                    /////lo que vendio el grupo 20 de esta marca en el mes, y cuantos vendedores
                    total: {venta: redondear(totalVenta), vendedores: lista.length},
                    top: lista.slice(0, TOP).map((v,i)=>{
                        const antes = anterior.findIndex(x=>x.codven === v.codven);
                        const puestoAnterior = antes < 0 ? null : antes + 1;
                        return {
                            puesto: i + 1,
                            codven: v.codven,
                            nombre: (datos[v.codven] || {}).nombre || null,
                            tipo: (datos[v.codven] || {}).tipo || null,
                            venta: redondear(v.venta),
                            participacion: totalVenta > 0 ? redondear(v.venta / totalVenta * 100) : null,
                            unidades: v.unidades,
                            clientes: v.clientes,
                            anterior: {puesto: puestoAnterior, venta: antes < 0 ? null : redondear(anterior[antes].venta)},
                            tendencia: puestoAnterior == null ? 'nuevo'
                                     : puestoAnterior > i + 1 ? 'sube'
                                     : puestoAnterior < i + 1 ? 'baja' : 'igual'
                        };
                    })
                };
            })
        };
    });
}

module.exports={vendedormes_top}
