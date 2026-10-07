const {Request,TYPES} = require('../../conexion/cadena');

/////Detalle de un cliente para el vendedor que pregunta: como va el mes con el, que le
/////compra mas, y que le toca reponer.
/////
/////Todo se mide SOLO sobre las ventas de este vendedor a este cliente. Un cliente puede
/////comprarle a varios; aqui interesa la relacion de quien abre la ficha.
/////
/////Las tres consultas van sobre la misma conexion. Arrancan por mst01fac, que filtra por
/////fecha con indice, y entran a dtl01fac por su clave cdocu+ndocu. Hacerlo al reves
/////-empezar por el detalle y filtrar despues- costaba 3.1 s contra 0.2 s.

const VENTANA_TOP = 3;        ////meses naturales anteriores para "lo que mas compra"
const VENTANA_REPONER = 12;   ////meses para medir el ritmo: con 3 no caben 3 compras de un producto mensual
const MINIMO_COMPRAS = 3;     ////con 2 compras hay un solo intervalo, y un intervalo no es un ritmo
const CICLOS_MAXIMO = 3;      ////pasado esto no es un retraso, es que dejo de comprarlo
const CUANTOS = 10;

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
const texto = (v)=> v===null || v===undefined ? null : (typeof v==='string' ? v.trim() : v);

/////Las facturas y boletas de este vendedor a este cliente, dentro de una ventana de meses.
/////Se reusa en las tres consultas para no repetir el filtro.
const DOCUMENTOS = (meses)=>`
    select f.cdocu, f.ndocu from mst01fac f
    where f.codcli=@cli and f.codven_usu=@codven and f.cdocu in('01','03')
      and ISNULL(f.flag,'')<>'*'
      and f.fecha >= DATEADD(month,-${meses},DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))`;

let cliente_detalle = async (resolve,reject,conexion,galleta,cuerpo)=>{
    const codven = galleta ? galleta.codigo : null;
    const codcli = String((cuerpo && cuerpo.codcli) || '').trim();

    if(!codven){ conexion.close(); return reject("falsa galleta"); }
    if(!codcli){ conexion.close(); return reject("codigo no existe"); }

    const parametros = ()=>[
        {nombre:'cli',tipo:TYPES.VarChar,valor:codcli},
        {nombre:'codven',tipo:TYPES.VarChar,valor:codven}
    ];

    try{
        /////1) el cliente tiene que ser de este vendedor: asignado, o facturado por el en
        /////   el ultimo año. Si no, no se devuelve nada de nadie.
        const suyo = await ejecutar(conexion,
            `select 1 where exists(select 1 from mst01cli where codcli=@cli and codven=@codven)
                         or exists(${DOCUMENTOS(VENTANA_REPONER)})`,
            parametros());

        if(suyo.length===0){
            conexion.close();
            return reject("cliente ajeno");
        }

        /////2) el mes en curso contra el anterior. Se agrupa por moneda porque sumar
        /////   soles con dolares no significa nada.
        const porMoneda = await ejecutar(conexion,
            `select f.mone,
                    SUM(case when f.fecha>=DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1) then f.totn else 0 end) actual,
                    SUM(case when f.fecha< DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1) then f.totn else 0 end) anterior,
                    COUNT(distinct case when f.fecha>=DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1) then f.ndocu end) documentos
             from mst01fac f
             where f.codcli=@cli and f.codven_usu=@codven and f.cdocu in('01','03')
               and ISNULL(f.flag,'')<>'*'
               and f.fecha >= DATEADD(month,-1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))
             group by f.mone`,
            parametros());

        /////3) lo que mas compra, por cantidad, en los meses naturales anteriores.
        /////   El importe tambien viaja: deja ver las dos cifras en la misma fila.
        const top = await ejecutar(conexion,
            `with docs as (${DOCUMENTOS(VENTANA_TOP)} and f.fecha < DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))
             select top ${CUANTOS} MAX(d.descr) descripcion, SUM(d.cant) cantidad,
                    SUM(d.tota) importe, MAX(d.mone) moneda
             from dtl01fac d inner join docs on docs.cdocu=d.cdocu and docs.ndocu=d.ndocu
             where d.cant>0
             group by d.codi
             order by SUM(d.cant) desc`,
            parametros());

        /////4) que le toca reponer: el ritmo de cada producto y cuanto lleva pasado.
        /////   mediana y no promedio en las dos: una compra grande y rara desplaza el
        /////   promedio y deja un ritmo que no existe.
        const reponer = await ejecutar(conexion,
            `with docs as (${DOCUMENTOS(VENTANA_REPONER)}),
             compras as (
               select d.codi, MAX(d.descr) descr, CAST(d.fecha as date) dia, SUM(d.cant) cant
               from dtl01fac d inner join docs on docs.cdocu=d.cdocu and docs.ndocu=d.ndocu
               where d.cant>0 group by d.codi, CAST(d.fecha as date)),
             huecos as (
               select codi, descr, dia, cant,
                      DATEDIFF(day, LAG(dia) OVER (PARTITION BY codi ORDER BY dia), dia) dias
               from compras),
             medianas as (
               select distinct codi,
                 MAX(descr) OVER (PARTITION BY codi) descr,
                 PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dias) OVER (PARTITION BY codi) cada,
                 PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cant) OVER (PARTITION BY codi) cantidad,
                 MAX(dia) OVER (PARTITION BY codi) ultima,
                 COUNT(*) OVER (PARTITION BY codi) compras
               from huecos)
             select top ${CUANTOS} descr descripcion,
                    CAST(ROUND(cantidad,0) as int) cantidad,
                    CAST(ROUND(cada,0) as int) cada,
                    CONVERT(varchar(10),ultima,120) ultima,
                    compras
             from medianas
             where compras >= ${MINIMO_COMPRAS} and cada is not null and cada > 0
               and DATEDIFF(day,ultima,GETDATE()) > cada
               and DATEDIFF(day,ultima,GETDATE()) <= cada*${CICLOS_MAXIMO}
             order by (DATEDIFF(day,ultima,GETDATE()) - cada) desc`,
            parametros());

        conexion.close();
        resolve({
            mes: resumirMes(porMoneda),
            top: top.map(f=>({
                descripcion: texto(f[0].value),
                cantidad: Number(f[1].value),
                importe: Number(Number(f[2].value).toFixed(2)),
                moneda: texto(f[3].value)
            })),
            reponer: reponer.map(f=>({
                descripcion: texto(f[0].value),
                cantidad: Number(f[1].value),
                cada: Number(f[2].value),
                ultima: texto(f[3].value),
                compras: Number(f[4].value)
            }))
        });
    }
    catch(err){
        console.error("[cliente_detalle]",err);
        conexion.close();
        reject("error query");
    }
}

/////Un cliente puede comprar en soles y en dolares. Se devuelve la moneda con mas peso
/////en vez de sumarlas, que no significaria nada; si hay mas de una se avisa, para que la
/////pantalla pueda decirlo en vez de dar una cifra incompleta.
function resumirMes(filas){
    if(filas.length===0) return {total:0, moneda:null, documentos:0, anterior:0, otrasMonedas:false};

    const monedas = filas.map(f=>({
        moneda: texto(f[0].value),
        actual: Number(f[1].value||0),
        anterior: Number(f[2].value||0),
        documentos: Number(f[3].value||0)
    }));
    monedas.sort((a,b)=> (b.actual - a.actual) || (b.anterior - a.anterior));
    const principal = monedas[0];

    return {
        total: Number(principal.actual.toFixed(2)),
        moneda: principal.moneda,
        documentos: principal.documentos,
        anterior: Number(principal.anterior.toFixed(2)),
        otrasMonedas: monedas.length > 1
    };
}

module.exports={cliente_detalle}
