const {Request,TYPES} = require('../../conexion/cadena');

/////Los tres bloques que acompañan al avance de la cuota. Todos salen de datos que ya
/////existen; ninguno necesita tablas nuevas.
/////
/////  ritmo       como va contra el calendario, y como suele cerrar este vendedor
/////  notas       cuanto le resta de lo facturado por notas de credito
/////  reposicion  que clientes tienen compras vencidas, y por cuanto
/////
/////Las tres consultas van sobre la MISMA conexion, una detras de otra. Si alguna falla
/////se devuelve null en su bloque y la pantalla se abre igual: el avance es lo primordial
/////y no puede caerse porque un añadido no cargue.

const TOPE_CICLOS = 3;      ////pasado esto el cliente dejo de comprarlo, no va retrasado
const MINIMO_COMPRAS = 3;   ////con dos compras hay un intervalo, y un intervalo no es un ritmo
const MESES_ATRAS = 12;
const CUANTOS_CLIENTES = 5;
const AVISO_NOTAS = 10;     ////por debajo de este % las notas son ruido y no se avisa

function ejecutar(conexion, sql, parametros){
    return new Promise((resolve,reject)=>{
        const consulta = new Request(sql,(err,rowCount,rows)=>{
            if(err) return reject(err);
            resolve(rows||[]);
        });
        (parametros||[]).forEach(p=>consulta.addParameter(p.nombre,p.tipo,p.valor));
        conexion.execSql(consulta);
    });
}
const num = (v)=> v==null ? 0 : Number(v);
const txt = (v)=> v==null ? '' : String(v).trim();

/////Los tres ultimos meses con meta cargada, con lo que cerro en cada uno. Sirve para
/////saber si ir al 50% el dia 20 es alarma o es como siempre.
/////
/////OJO con los dos identificadores: la meta vive en tbl_api_vendedores_meta y se llave
/////por codusu (numerico, 406); lo facturado vive en mst01fac y se llave por codven
/////(V0336). No son el mismo campo, y cruzarlos mal devuelve cero sin avisar.
const HISTORICO = `
select top 3 CAST(m.anno AS varchar(4))+'-'+RIGHT('0'+CAST(m.mes AS varchar(2)),2) as periodo,
       CAST(m.monto AS decimal(14,2)) as meta,
       CAST(ISNULL((select SUM(CASE f.mone WHEN 'D' THEN f.tota WHEN 'S' THEN f.tota/NULLIF(f.tcam,0) END)
                    from mst01fac f
                    where f.flag<>'*' and f.codvta<>'04' and f.codven_usu=@codven
                      and YEAR(f.fecha)=m.anno and MONTH(f.fecha)=m.mes),0) AS decimal(14,2)) as avance
from tbl_api_vendedores_meta m
where m.codven=@codusu and m.monto>0
  and (m.anno < YEAR(GETDATE()) or (m.anno=YEAR(GETDATE()) and m.mes < MONTH(GETDATE())))
order by m.anno desc, m.mes desc`;

/////Lo facturado del mes separado de lo que restan las notas de credito. El avance de la
/////cuota es venta NETA, asi que una devolucion grande baja el porcentaje sin que nada
/////lo explique.
const NOTAS = `
select CAST(SUM(case when cdocu in('01','03') then (case mone when 'D' then tota when 'S' then tota/NULLIF(tcam,0) end) else 0 end) AS decimal(14,2)) as facturado,
       CAST(SUM(case when cdocu='07'          then (case mone when 'D' then tota when 'S' then tota/NULLIF(tcam,0) end) else 0 end) AS decimal(14,2)) as notas
from mst01fac
where flag<>'*' and codvta<>'04' and codven_usu=@codven
  and YEAR(fecha)=YEAR(GETDATE()) and MONTH(fecha)=MONTH(GETDATE())`;

/////El mismo calculo de ritmo de compra que usa la ficha de cliente, pero sobre TODOS los
/////clientes del vendedor y valorizado en dolares. Mediana y no promedio: una compra
/////grande y rara desplaza el promedio y deja un ritmo que no existe.
/////
/////Arranca por la cabecera, que filtra por fecha con indice, y entra al detalle por su
/////clave. Al reves costaba segundos en vez de milisegundos.
const REPOSICION = `
with docs as (
  select f.cdocu, f.ndocu, f.codcli, f.mone, f.tcam
  from mst01fac f
  where f.fecha>=DATEADD(month,-${MESES_ATRAS},GETDATE()) and f.codven_usu=@codven
    and f.cdocu in('01','03') and ISNULL(f.flag,'')<>'*'),
compras as (
  select docs.codcli, d.codi, CAST(d.fecha as date) dia,
         SUM(case docs.mone when 'D' then d.tota when 'S' then d.tota/NULLIF(docs.tcam,0) end) valor
  from dtl01fac d inner join docs on docs.cdocu=d.cdocu and docs.ndocu=d.ndocu
  where d.cant>0 group by docs.codcli, d.codi, CAST(d.fecha as date)),
huecos as (
  select codcli, codi, dia, valor,
         DATEDIFF(day, LAG(dia) OVER (PARTITION BY codcli,codi ORDER BY dia), dia) dias
  from compras),
medianas as (
  select distinct codcli, codi,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dias)  OVER (PARTITION BY codcli,codi) cada,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY valor) OVER (PARTITION BY codcli,codi) valor_tipico,
    MAX(dia) OVER (PARTITION BY codcli,codi) ultima,
    COUNT(*)  OVER (PARTITION BY codcli,codi) compras
  from huecos),
vencidos as (
  select codcli, codi, valor_tipico from medianas
  where compras >= ${MINIMO_COMPRAS} and cada is not null and cada > 0
    and DATEDIFF(day,ultima,GETDATE()) > cada
    and DATEDIFF(day,ultima,GETDATE()) <= cada*${TOPE_CICLOS})
select v.codcli, LTRIM(RTRIM(c.nomcli)) cliente,
       COUNT(*) productos,
       CAST(SUM(v.valor_tipico) AS decimal(14,2)) vencido,
       CAST(SUM(SUM(v.valor_tipico)) OVER () AS decimal(14,2)) total,
       COUNT(*) OVER () clientes
from vencidos v inner join mst01cli c on c.codcli=v.codcli
group by v.codcli, c.nomcli
order by 4 desc`;

let avance_detalle = async (resolve,reject,conexion,codven,codusu,meta,avance)=>{
    const salida = {falta:null, ritmo:null, notas:null, reposicion:null};

    /////A) lo que falta, en dinero. No necesita consulta.
    const m = num(meta), a = num(avance);
    salida.falta = m > 0 ? Number((m - a).toFixed(2)) : null;

    /////B) el ritmo contra el calendario: cuanto del mes va transcurrido
    const hoy = new Date();
    const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate();
    const esperado = Number(((hoy.getDate() / diasDelMes) * 100).toFixed(1));
    const real = m > 0 ? Number(((a / m) * 100).toFixed(1)) : null;

    try{
        const filas = await ejecutar(conexion, HISTORICO,
            [{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu},
             {nombre:'codven',tipo:TYPES.VarChar,valor:codven}]);

        const historico = filas.map(f=>{
            const metaH = num(f[1].value), avanceH = num(f[2].value);
            return {periodo: txt(f[0].value),
                    porcentaje: metaH > 0 ? Number(((avanceH/metaH)*100).toFixed(1)) : null};
        });
        /////un mes en negativo o en cero no es un cierre malo: es un mes sin datos o con
        /////mas devoluciones que ventas. Entra en la lista para que se vea, pero no en la
        /////media, que si no dice que el vendedor cierra peor de lo que cierra.
        const cerrados = historico.filter(h=>h.porcentaje!==null && h.porcentaje>0).map(h=>h.porcentaje);
        const media = cerrados.length
            ? Number((cerrados.reduce((s,v)=>s+v,0)/cerrados.length).toFixed(1)) : null;

        salida.ritmo = {
            esperado: esperado, real: real,
            estado: real===null ? null : (real >= esperado ? "al dia" : "detras"),
            historico: historico, cierreTipico: media
        };
    }catch(err){ console.error("[avance_detalle historico]",err); }

    try{
        const filas = await ejecutar(conexion, NOTAS,
            [{nombre:'codven',tipo:TYPES.VarChar,valor:codven}]);
        if(filas.length){
            const facturado = num(filas[0][0].value);
            const restado = Math.abs(num(filas[0][1].value));
            const peso = facturado > 0 ? Number(((restado/facturado)*100).toFixed(1)) : 0;
            salida.notas = {facturado:facturado, restado:restado,
                            porcentaje:peso, avisar: peso >= AVISO_NOTAS};
        }
    }catch(err){ console.error("[avance_detalle notas]",err); }

    try{
        const filas = await ejecutar(conexion, REPOSICION,
            [{nombre:'codven',tipo:TYPES.VarChar,valor:codven}]);
        salida.reposicion = {
            total: filas.length ? num(filas[0][4].value) : 0,
            clientes: filas.length ? num(filas[0][5].value) : 0,
            top: filas.slice(0,CUANTOS_CLIENTES).map(f=>({
                codcli: txt(f[0].value), cliente: txt(f[1].value),
                productos: num(f[2].value), vencido: num(f[3].value)
            }))
        };
    }catch(err){ console.error("[avance_detalle reposicion]",err); }

    conexion.close();
    resolve(salida);
}

module.exports={avance_detalle}
