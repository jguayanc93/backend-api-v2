const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto} = require('../marcas/comun')

/////Que venta le cuenta a cada vendedor del grupo 20 (decidido el 2026-10-24). Un solo sitio:
/////lo usan el avance y la probabilidad del jefe de zona, su cartera y cobertura, y la pantalla
/////de cuota del propio vendedor, para que jefe y vendedor nunca discutan dos cifras.
/////
/////  - venta: total de la factura (tota) en dolares y con IGV; las notas de credito restan
/////    (ya vienen en negativo); sin anuladas (flag '*') ni transferencias gratuitas (codvta 04)
/////  - COBERTURA: todo lo que facturo el (codven_usu), sea de quien sea el cliente
/////  - CARTERA: lo que facturo el (codven_usu) a clientes de un vendedor de cartera: los suyos
/////    y, cuando reemplaza a un compañero de vacaciones, los de ese compañero. Lo que otro le
/////    factura a sus clientes NO le cuenta, tampoco si es de cobertura.
/////
/////En mst01fac, codven es el dueño del cliente al facturar y codven_usu quien facturo (en
/////octubre de 2026 codven coincide con mst01cli.codven en el 98 % de las facturas).
/////Hasta el 2026-10-24 cartera sumaba por codven: le contaba lo que otros facturaban a sus
/////clientes, y la venta de un reemplazo de cobertura se contaba dos veces, a los dos.

const MONTO = (a)=>`case ${a}.mone when 'D' then ${a}.tota when 'S' then ${a}.tota/nullif(${a}.tcam,0) end`;
const VALIDA = (a)=>`${a}.flag<>'*' and ${a}.codvta<>'04'`;
const CARTERAS = `select rtrim(codven) from tbl_api_vendedores_diferenciador where upper(rtrim(diferenciador))='CARTERA'`;
/////la factura es de un cliente de cartera: le puede contar al vendedor de cartera que la hizo
const DE_CARTERA = (a)=>`rtrim(${a}.codven) in (${CARTERAS})`;

/////Cliente libre: de la oficina (V0000) o sin dueño. Los toma sobre todo cobertura. A un vendedor de
/////CARTERA que le factura a uno, el monto no le cuenta, pero el cliente si cuenta como atendido en
/////su cobertura de clientes (decidido el 2026-10-24, tras hablarlo con los vendedores). Los
/////clientes de un vendedor de cobertura no le cuentan de ninguna forma.
const esLibre = (dueno)=>!dueno || dueno === 'V0000';

/////los codven de los vendedores de cartera
async function carteras(conexion){
    const r = await ejecutar(conexion, CARTERAS);
    return new Set(r.rows.map(f=>texto(f[0].value)));
}

/////Reemplazo por vacaciones. No queda registrado en ninguna parte, pero se ve en las facturas:
/////el dueño casi no factura a su cartera y otro vendedor le factura la mayor parte. En 2026 hay
/////seis meses asi; en todos el dueño solo tuvo notas de credito y el otro facturo del 72 al 99 %.
const REEMPLAZO_PROPIO_MAXIMO = 0.10;
const REEMPLAZO_OTRO_MINIMO = 0.50;

/////De un mes: {dueño: {codven, venta, porcentaje}} con quien atendio la cartera de cada vendedor
/////de cartera reemplazado. Fechas AAAA-MM-DD, fin exclusivo.
async function reemplazos(conexion, inicio, fin){
    const r = await ejecutar(conexion,
        `select rtrim(f.codven), rtrim(f.codven_usu), sum(${MONTO('f')})
         from mst01fac f
         where f.fecha>=@desde and f.fecha<@hasta and ${VALIDA('f')} and ${DE_CARTERA('f')}
         group by f.codven, f.codven_usu`,
        [{nombre:'desde',tipo:TYPES.VarChar,valor:inicio.replace(/-/g,'')},
         {nombre:'hasta',tipo:TYPES.VarChar,valor:fin.replace(/-/g,'')}]);
    const porDueno = {};
    r.rows.forEach(f=>{
        const v = f.map(c=>c.value);
        if(v[2] == null || !v[0] || !v[1]) return;
        const quienes = (porDueno[texto(v[0])] = porDueno[texto(v[0])] || {});
        quienes[texto(v[1])] = (quienes[texto(v[1])] || 0) + Number(v[2]);
    });
    const resultado = {};
    Object.keys(porDueno).forEach(dueno=>{
        const quienes = porDueno[dueno];
        const total = Object.values(quienes).reduce((s,x)=>s + x, 0);
        if(!(total > 0)) return;
        const propio = quienes[dueno] || 0;
        let otro = null;
        Object.keys(quienes).forEach(c=>{ if(c !== dueno && (!otro || quienes[c] > quienes[otro])) otro = c; });
        if(otro && propio <= REEMPLAZO_PROPIO_MAXIMO * total && quienes[otro] >= REEMPLAZO_OTRO_MINIMO * total){
            resultado[dueno] = {codven: otro, venta: quienes[otro], porcentaje: Math.round(quienes[otro] / total * 1000) / 10};
        }
    });
    return resultado;
}

/////El nombre de cada codven. Un codven puede estar en varios usuarios (V0278): se prefiere el
/////activo del grupo 20. V0000 lo comparten la oficina y varias cuentas genericas (Brissa,
/////"Usuario Vendedor"...): se llama siempre OFICINA.
const OFICINA = 'V0000';
async function nombres(conexion, codvens){
    const lista = [...new Set(codvens.filter(c=>c && c !== OFICINA))];
    if(lista.length === 0) return codvens.includes(OFICINA) ? {[OFICINA]:'OFICINA'} : {};
    const parametros = lista.map((c,i)=>({nombre:`c${i}`, tipo:TYPES.VarChar, valor:c}));
    const r = await ejecutar(conexion,
        `select rtrim(codven), rtrim(nomusu) from fcu0000
         where rtrim(codven) in (${lista.map((c,i)=>`@c${i}`).join(',')})
         order by case when estado=1 then 0 else 1 end, case when rtrim(codgru)='20' then 0 else 1 end`,
        parametros);
    const salida = {[OFICINA]:'OFICINA'};
    r.rows.forEach(f=>{ const c = texto(f[0].value); if(!(c in salida)) salida[c] = texto(f[1].value); });
    return salida;
}

module.exports = {MONTO, VALIDA, CARTERAS, DE_CARTERA, esLibre, carteras, reemplazos, nombres};
