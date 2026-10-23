/////Recalcula CALIBRACION de querys/zona/modelo.js con los cierres reales. Solo lee.
/////    node querys/zona/calibrar.js
/////Toma cada cuota de un mes ya cerrado, calcula la probabilidad simulada a los dias 10, 15, 20 y
/////25 y la compara con si llego o no. Imprime los coeficientes nuevos y cuanto acierta cada uno:
/////si los nuevos aciertan mejor (brier mas bajo), se copian a CALIBRACION.
require('dotenv').config({quiet:true});
const {Connection,Request,config,descripcion} = require('../../conexion/cadena');
const M = require('./modelo');
const {DIAS_HISTORIA_PROBABILIDAD} = require('../../funciones/comunes/constantes');

const CORTES = [10, 15, 20, 25];
const conexion = new Connection(config);
const leer = (sql)=>new Promise((resolve,reject)=>{
    conexion.execSql(new Request(sql,(err,n,rows)=>err ? reject(err) : resolve(rows.map(f=>f.map(c=>c.value)))));
});

const logit = (p)=>{ p = Math.min(Math.max(p, 0.005), 0.995); return Math.log(p/(1-p)); };
function ajustar(casos){
    let a = 1, b = 0;
    for(let i = 0; i < 3000; i++){
        let ga = 0, gb = 0;
        casos.forEach(c=>{ const x = logit(c.simulada), q = 1/(1+Math.exp(-(a*x+b))); ga += (q-c.logro)*x; gb += (q-c.logro); });
        a -= 0.05*ga/casos.length; b -= 0.05*gb/casos.length;
    }
    return {a, b};
}
const brier = (casos, f)=>casos.reduce((s,c)=>s + (f(c) - c.logro)**2, 0) / casos.length;
const aplicar = ({a,b})=>(c)=>c.imposible ? c.simulada : 1/(1+Math.exp(-(a*logit(c.simulada)+b)));

conexion.on('connect', async (err)=>{
    if(err){ console.error(err.message); process.exit(1); }
    console.log('#', descripcion());
    const metas = await leer(`select rtrim(m.codven), rtrim(u.codven), m.anno, m.mes, upper(rtrim(m.diferenciador)), m.monto
        from tbl_api_vendedores_meta m join fcu0000 u on rtrim(u.codusu)=rtrim(m.codven)
        where m.monto>0 and m.anno*12+m.mes < year(getdate())*12+month(getdate())`);
    const diario = await leer(`select convert(char(10),fecha,23), rtrim(codven), rtrim(codven_usu),
        sum(case mone when 'D' then tota when 'S' then tota/nullif(tcam,0) end)
        from mst01fac where fecha>=dateadd(month,-30,getdate()) and flag<>'*' and codvta<>'04' group by fecha, codven, codven_usu`);
    const dias = (await leer(`select distinct convert(char(10),fecha,23) from mst01fac
        where fecha>=dateadd(month,-30,getdate()) and flag<>'*' order by 1`)).map(f=>f[0].trim());

    const mapas = {cartera:{}, cobertura:{}};
    const sumar = (m,k,d,v)=>{ (m[k] = m[k] || {})[d] = (m[k][d] || 0) + v; };
    diario.forEach(([d,cv,cu,v])=>{ if(v == null) return; d = d.trim(); if(cv) sumar(mapas.cartera,cv,d,v); if(cu) sumar(mapas.cobertura,cu,d,v); });

    const casos = [];
    metas.forEach(([codusu,codven,anno,mes,tipo,meta])=>{
        const ventas = (tipo === 'CARTERA' ? mapas.cartera : mapas.cobertura)[codven] || {};
        const inicio = M.fechaDe(anno,mes,1), fin = M.sumarDias(M.fechaDe(anno,mes,M.diasDelMes(anno,mes)),1);
        let cierre = 0; Object.keys(ventas).forEach(d=>{ if(d >= inicio && d < fin) cierre += ventas[d]; });
        CORTES.forEach(dia=>{
            const corte = M.fechaDe(anno,mes,dia);
            const r = M.probabilidadAlCorte({ventas, diasEmpresa:dias, meta:Number(meta), corte,
                                             diasHistoria:DIAS_HISTORIA_PROBABILIDAD, semilla:`${codusu}|${corte}`});
            if(r.simulada == null) return;     ////sin historia, meta ya alcanzada o mes sin dias
            const imposible = r.ritmo.habitual > 0 && r.ritmo.necesario > M.TOPE_RITMO * r.ritmo.habitual;
            casos.push({simulada:r.simulada, imposible, logro: cierre >= meta ? 1 : 0});
        });
    });

    const nuevos = ajustar(casos.filter(c=>!c.imposible));
    console.log(`casos: ${casos.length} (llegaron ${casos.filter(c=>c.logro).length})`);
    console.log(`sin corregir      brier ${brier(casos, c=>c.simulada).toFixed(3)}`);
    console.log(`CALIBRACION hoy   brier ${brier(casos, aplicar(M.CALIBRACION)).toFixed(3)}  a ${M.CALIBRACION.a} b ${M.CALIBRACION.b}`);
    console.log(`nuevos            brier ${brier(casos, aplicar(nuevos)).toFixed(3)}  a ${nuevos.a.toFixed(3)} b ${nuevos.b.toFixed(3)}`);
    console.log(`siempre la media  brier ${brier(casos, ()=>casos.filter(c=>c.logro).length/casos.length).toFixed(3)}`);
    conexion.close();
});
conexion.connect();
