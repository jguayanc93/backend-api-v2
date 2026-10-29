const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto} = require('../marcas/comun')
const {VALOR_MINIMO_PRODUCTO_HOY, DIAS_REACTIVAR_HOY} = require('../../funciones/comunes/constantes')

/////De donde salen los clientes que se le sugieren a un vendedor del grupo 20 en ¿A quien vender hoy?
/////Solo lectura. Todo se mide hasta "hoy" y no hasta GETDATE(): @hoy llega como AAAAMMDD, y asi las
/////pruebas pueden simular un dia pasado sin esperar a que llegue. En produccion es la fecha del servidor.
/////
/////Las ventas que cuentan son las que facturo el propio vendedor (codven_usu): facturas y boletas
/////(01 y 03), sin anuladas. Un vendedor de CARTERA ademas solo cuenta las hechas a clientes de cartera
/////(querys/zona/regla.js): para cartera heredada no se usa el historial completo del cliente.
/////
/////Los candidatos, de mas a menos importantes (cada uno tiene su tipo):
/////  REPONER      compra un producto con ritmo (3 compras o mas) y ya le toca: mediana de dias entre
/////               compras, vencido si paso ese ritmo y no mas de 3 veces. Mismo calculo de
/////               querys/cuota/avance_detalle.js, valorizado en dolares. Se ordena por el valor tipico
/////  LLAMAR       compro el mes pasado, no este mes, y compro en 2 o mas de los ultimos 6 meses (uno
/////               que compro una sola vez fuerte no es un cliente que se llame). Por media mensual
/////  REACTIVAR    su ultima compra fue hace DIAS_REACTIVAR_HOY dias o mas, dentro de los 12 meses
/////  SIN_COMPRAS  asignado al vendedor (mst01cli.codven), activo, sin ninguna factura en 12 meses
/////  LIBRE        de la oficina (V0000) o sin dueño, activo, con compras en 12 meses; solo cobertura
/////Los cuatro ultimos son respaldo: solo se usan para llenar un cupo vacio.
/////
/////Los clientes inactivos (estado=0) no se sugieren. La lista de clientes excluidos (la propia empresa
/////y fabricantes) la aplica quien arma el dia.

const HOY = `CONVERT(date,@hoy,112)`;
const HASTA_HOY = (a)=>`${a}.fecha<DATEADD(day,1,${HOY})`;
const MES = `DATEFROMPARTS(YEAR(${HOY}),MONTH(${HOY}),1)`;
const MESES_RITMO = 12;
const MINIMO_COMPRAS = 3;   ////con 2 compras hay un solo intervalo, y un intervalo no es un ritmo
const TOPE_CICLOS = 3;      ////pasado esto no es un retraso, es que dejo de comprarlo
const MONTO = (a)=>`CASE ${a}.mone WHEN 'D' THEN ${a}.tota WHEN 'S' THEN ${a}.tota/NULLIF(${a}.tcam,0) END`;

const p = (nombre, tipo, valor)=>({nombre, tipo, valor});
const base = (ctx, extra)=>[p('codven',TYPES.VarChar,ctx.codven), p('hoy',TYPES.VarChar,ctx.hoy)].concat(extra || []);
const num = (v)=> v == null ? 0 : Number(v);
const dia = (v)=> v instanceof Date ? v.toISOString().slice(0,10) : texto(v);

/////Productos con ritmo de compra y ya vencidos. Con cli, solo de ese cliente (el detalle de una tarjeta).
/////Se ignoran los productos que ya no estan vigentes y los de valor casi cero.
const VENCIDOS = (ctx, cli)=>`
docs as (select f.cdocu, f.ndocu, f.codcli, f.mone, f.tcam from mst01fac f
  where f.fecha>=DATEADD(month,-${MESES_RITMO},${HOY}) and ${HASTA_HOY('f')} and f.codven_usu=@codven
    and f.cdocu in('01','03') and ISNULL(f.flag,'')<>'*'${ctx.filtro}${cli ? ' and f.codcli=@cli' : ''}),
compras as (select docs.codcli, d.codi, CAST(d.fecha as date) dia, SUM(d.cant) cant,
    SUM(case docs.mone when 'D' then d.tota when 'S' then d.tota/NULLIF(docs.tcam,0) end) valor
  from dtl01fac d inner join docs on docs.cdocu=d.cdocu and docs.ndocu=d.ndocu where d.cant>0
  group by docs.codcli, d.codi, CAST(d.fecha as date)),
huecos as (select codcli, codi, dia, cant, valor, DATEDIFF(day, LAG(dia) OVER (PARTITION BY codcli,codi ORDER BY dia), dia) dias from compras),
med as (select distinct codcli, codi,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dias) OVER (PARTITION BY codcli,codi) cada,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY valor) OVER (PARTITION BY codcli,codi) valor_tipico,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cant) OVER (PARTITION BY codcli,codi) cantidad,
    MAX(dia) OVER (PARTITION BY codcli,codi) ultima, COUNT(*) OVER (PARTITION BY codcli,codi) compras from huecos),
venc as (select m.codcli, m.codi, m.cada, m.valor_tipico, m.cantidad, m.ultima, m.compras
  from med m inner join prd0101 pr on pr.codi=m.codi and pr.estado=1
  where m.compras>=${MINIMO_COMPRAS} and m.cada is not null and m.cada>0 and m.valor_tipico>${VALOR_MINIMO_PRODUCTO_HOY}
    and DATEDIFF(day,m.ultima,${HOY})>m.cada and DATEDIFF(day,m.ultima,${HOY})<=m.cada*${TOPE_CICLOS})`;

/////REPONER: [codcli, cliente, productos, valor vencido en US$, activo]
async function reponer(conexion, ctx){
    const r = await ejecutar(conexion,
        `with ${VENCIDOS(ctx, false)}
         select rtrim(v.codcli), LTRIM(RTRIM(c.nomcli)), COUNT(*), CAST(SUM(v.valor_tipico) AS decimal(14,2)), c.estado
         from venc v inner join mst01cli c on c.codcli=v.codcli
         group by v.codcli, c.nomcli, c.estado order by 4 desc`, base(ctx));
    return r.rows.map(f=>{
        const v = f.map(c=>c.value);
        return {codcli:texto(v[0]), cliente:texto(v[1]), productos:v[2], valor:num(v[3]), activo:v[4] === 1};
    });
}

/////Los productos vencidos de un cliente, los de mas valor primero
async function productosVencidos(conexion, ctx, codcli, cuantos){
    const r = await ejecutar(conexion,
        `with ${VENCIDOS(ctx, true)}
         select top ${cuantos} rtrim(pr.descr), rtrim(pr.Usr_001), CAST(ROUND(v.cantidad,0) as int), CAST(ROUND(v.cada,0) as int),
                CONVERT(varchar(10),v.ultima,120), v.compras
         from venc v inner join prd0101 pr on pr.codi=v.codi
         order by v.valor_tipico desc`, base(ctx, [p('cli',TYPES.VarChar,codcli)]));
    return r.rows.map(f=>{
        const v = f.map(c=>c.value);
        return {descripcion:texto(v[0]) || '', partNumber:texto(v[1]) || '', cantidad:v[2], cada:v[3], ultima:texto(v[4]), compras:v[5]};
    });
}

/////LLAMAR: compro el mes pasado y este mes nada.
/////[codcli, cliente, facturas del mes pasado, meses con compra, media mensual en US$, ultima compra, activo]
async function llamar(conexion, ctx){
    const r = await ejecutar(conexion,
        `with docs as (select f.codcli, f.fecha, f.ndocu, ${MONTO('f')} usd
           from mst01fac f where f.codven_usu=@codven and f.cdocu in('01','03') and ISNULL(f.flag,'')<>'*' and f.codvta<>'04'${ctx.filtro}
             and f.fecha>=DATEADD(month,-6,${MES}) and ${HASTA_HOY('f')})
         select rtrim(d.codcli), LTRIM(RTRIM(c.nomcli)),
           COUNT(distinct case when d.fecha>=DATEADD(month,-1,${MES}) and d.fecha<${MES} then d.ndocu end),
           COUNT(distinct case when d.fecha<${MES} then CONVERT(char(7),d.fecha,120) end),
           CAST(SUM(case when d.fecha<${MES} then d.usd else 0 end)/6 AS decimal(14,2)),
           MAX(d.fecha), c.estado
         from docs d inner join mst01cli c on c.codcli=d.codcli
         group by d.codcli, c.nomcli, c.estado
         having SUM(case when d.fecha>=${MES} then 1 else 0 end)=0
            and SUM(case when d.fecha>=DATEADD(month,-1,${MES}) and d.fecha<${MES} then 1 else 0 end)>0
         order by 5 desc`, base(ctx));
    return r.rows.map(f=>{
        const v = f.map(c=>c.value);
        return {codcli:texto(v[0]), cliente:texto(v[1]), facturasMesPasado:v[2], mesesConCompra:v[3],
                valor:num(v[4]), ultimaCompra:dia(v[5]), activo:v[6] === 1};
    }).filter(c=>c.mesesConCompra >= 2);
}

/////REACTIVAR: [codcli, cliente, ultima compra, compras de 12 meses en US$, activo]
async function reactivar(conexion, ctx){
    const r = await ejecutar(conexion,
        `select rtrim(f.codcli), LTRIM(RTRIM(c.nomcli)), max(f.fecha), CAST(sum(${MONTO('f')}) AS decimal(14,2)), c.estado
         from mst01fac f inner join mst01cli c on c.codcli=f.codcli
         where f.codven_usu=@codven and f.cdocu in('01','03') and ISNULL(f.flag,'')<>'*' and f.codvta<>'04'${ctx.filtro}
           and f.fecha>=DATEADD(month,-12,${HOY}) and ${HASTA_HOY('f')}
         group by f.codcli, c.nomcli, c.estado
         having max(f.fecha)<DATEADD(day,-${DIAS_REACTIVAR_HOY},${HOY})
         order by 4 desc`, base(ctx));
    return r.rows.map(f=>{
        const v = f.map(c=>c.value);
        return {codcli:texto(v[0]), cliente:texto(v[1]), ultimaCompra:dia(v[2]), valor:num(v[3]), activo:v[4] === 1};
    });
}

/////SIN_COMPRAS: asignados al vendedor, activos, a quienes nadie les facturo en 12 meses. Un anti-join
/////con un derivado y no NOT EXISTS: sobre mst01fac este ultimo pasaba el minuto
async function sinCompras(conexion, ctx, tope){
    const r = await ejecutar(conexion,
        `select top ${tope} rtrim(c.codcli), LTRIM(RTRIM(c.nomcli))
         from mst01cli c
         left join (select distinct codcli from mst01fac
                    where fecha>=DATEADD(month,-12,${HOY}) and ${HASTA_HOY('mst01fac')} and cdocu in('01','03') and ISNULL(flag,'')<>'*') f
                on f.codcli=c.codcli
         where rtrim(c.codven)=@codven and c.estado=1 and f.codcli is null
         order by c.codcli desc`, base(ctx));
    return r.rows.map(f=>({codcli:texto(f[0].value), cliente:texto(f[1].value), activo:true}));
}

/////LIBRE: de la oficina o sin dueño, con compras en 12 meses (de cualquier vendedor). Solo cobertura
async function libres(conexion, ctx, tope){
    const r = await ejecutar(conexion,
        `select top ${tope} rtrim(c.codcli), LTRIM(RTRIM(c.nomcli)), max(f.fecha), CAST(sum(${MONTO('f')}) AS decimal(14,2))
         from mst01cli c inner join mst01fac f on f.codcli=c.codcli
         where rtrim(isnull(c.codven,'')) in ('','V0000') and c.estado=1
           and f.cdocu in('01','03') and ISNULL(f.flag,'')<>'*' and f.codvta<>'04'
           and f.fecha>=DATEADD(month,-12,${HOY}) and ${HASTA_HOY('f')}
         group by c.codcli, c.nomcli
         order by 4 desc`, base(ctx));
    return r.rows.map(f=>({codcli:texto(f[0].value), cliente:texto(f[1].value), ultimaCompra:dia(f[2].value),
                           valor:num(f[3].value), activo:true}));
}

/////Lo que mas lleva un cliente (por cantidad) en los ultimos `meses`: la tarjeta de llamar y reactivar.
/////Llamar cuenta meses completos (como su media mensual); reactivar, meses corridos desde hoy (como su valor de 12 meses)
async function masLleva(conexion, ctx, codcli, meses, mesesCompletos = true){
    const r = await ejecutar(conexion,
        `with docs as (select f.cdocu, f.ndocu from mst01fac f
           where f.codcli=@cli and f.codven_usu=@codven and f.cdocu in('01','03') and ISNULL(f.flag,'')<>'*'${ctx.filtro}
             and f.fecha>=DATEADD(month,-${meses},${mesesCompletos ? MES : HOY}) and ${HASTA_HOY('f')})
         select top 3 LTRIM(RTRIM(MAX(d.descr))), rtrim(MAX(pr.Usr_001)), CAST(SUM(d.cant) as int)
         from dtl01fac d inner join docs on docs.cdocu=d.cdocu and docs.ndocu=d.ndocu
         left join prd0101 pr on pr.codi=d.codi
         where d.cant>0 group by d.codi order by SUM(d.cant) desc`, base(ctx, [p('cli',TYPES.VarChar,codcli)]));
    return r.rows.map(f=>({descripcion:texto(f[0].value) || '', partNumber:texto(f[1].value) || '', cantidad:f[2].value}));
}

module.exports={reponer, productosVencidos, llamar, reactivar, sinCompras, libres, masLleva}
