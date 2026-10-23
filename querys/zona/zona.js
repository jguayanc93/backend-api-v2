const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, soloLectura} = require('../marcas/comun')
const {leerPeriodo} = require('../marcas/ventas')
const M = require('./modelo')
const {MESES_HISTORIA_ZONA, MESES_COMPARAR_PROBABILIDAD, DIAS_HISTORIA_PROBABILIDAD} = require('../../funciones/comunes/constantes')

/////Jefe de zona (grupo 34): avance de cuota del grupo 20 y probabilidad de llegar a ella.
/////Contrato: docs/zona-grupo34.md
/////
/////El avance es EL MISMO numero que cada vendedor ve en su pantalla de cuota
/////(querys/cuota/cobertura.js y cartera.js), para que jefe y vendedor nunca discutan dos cifras:
/////  - total de la factura (tota) en dolares; las notas de credito ya vienen en negativo
/////  - sin anuladas (flag '*') ni transferencias gratuitas (codvta 04)
/////  - COBERTURA cuenta lo que facturo el (codven_usu); CARTERA lo de su cartera (codven)
/////No es la regla de la cuota por marca del grupo 25 (sin IGV, solo codvta 01 y 08).

const GRUPO_VENDEDORES = '20';

const DIARIO = `
select convert(char(10), f.fecha, 23), rtrim(f.codven), rtrim(f.codven_usu),
       sum(case f.mone when 'D' then f.tota when 'S' then f.tota/nullif(f.tcam,0) end)
from mst01fac f
where f.fecha>=@desde and f.fecha<@hasta and f.flag<>'*' and f.codvta<>'04'`;

/////Lo facturado por dia, por cartera y por vendedor que facturo: {cartera, cobertura}, cada
/////uno {codven: {AAAA-MM-DD: monto}}. Con codven, solo lo de ese vendedor.
async function ventasDiarias(conexion, desde, hasta, codven){
    const parametros = [{nombre:'desde',tipo:TYPES.VarChar,valor:desde.replace(/-/g,'')},
                        {nombre:'hasta',tipo:TYPES.VarChar,valor:hasta.replace(/-/g,'')}];
    let filtro = '';
    if(codven){
        filtro = ' and (f.codven=@codven or f.codven_usu=@codven)';
        parametros.push({nombre:'codven',tipo:TYPES.VarChar,valor:codven});
    }
    const r = await ejecutar(conexion, DIARIO + filtro + ' group by f.fecha, f.codven, f.codven_usu', parametros);
    const mapas = {cartera:{}, cobertura:{}};
    const sumar = (mapa, quien, dia, monto)=>{
        const dias = (mapa[quien] = mapa[quien] || {});
        dias[dia] = (dias[dia] || 0) + monto;
    };
    r.rows.forEach(f=>{
        const v = f.map(c=>c.value);
        if(v[3] == null) return;
        const dia = texto(v[0]), monto = Number(v[3]);
        if(v[1]) sumar(mapas.cartera, texto(v[1]), dia, monto);
        if(v[2]) sumar(mapas.cobertura, texto(v[2]), dia, monto);
    });
    return mapas;
}
function ventasDe(mapas, tipo, codven){
    return (tipo === 'CARTERA' ? mapas.cartera : mapas.cobertura)[codven] || {};
}
function sumarEntre(ventas, desde, hasta){
    let total = 0;
    Object.keys(ventas).forEach(d=>{ if(d >= desde && d < hasta) total += ventas[d]; });
    return total;
}

/////Los dias en que la empresa facturo algo: los que sirven de historia (sin domingos ni feriados)
async function diasConVentas(conexion, desde, hasta){
    const r = await ejecutar(conexion,
        `select distinct convert(char(10), fecha, 23) from mst01fac
         where fecha>=@desde and fecha<@hasta and flag<>'*' order by 1`,
        [{nombre:'desde',tipo:TYPES.VarChar,valor:desde.replace(/-/g,'')},
         {nombre:'hasta',tipo:TYPES.VarChar,valor:hasta.replace(/-/g,'')}]);
    return r.rows.map(f=>texto(f[0].value));
}

/////Hoy segun el servidor de la base (Lima), y la hora para "actualizado"
async function ahora(conexion){
    const r = await ejecutar(conexion, `select convert(char(10), getdate(), 23), convert(char(19), getdate(), 120)`);
    const hoy = texto(r.rows[0][0].value);
    return {hoy, momento: texto(r.rows[0][1].value), anno: Number(hoy.slice(0,4)), mes: Number(hoy.slice(5,7)), dia: Number(hoy.slice(8,10))};
}

function porcentaje(avance, meta){ return meta > 0 ? Math.round(avance / meta * 1000) / 10 : null; }
function limitesDe(anno, mes){
    const inicio = M.fechaDe(anno, mes, 1);
    return {inicio, fin: M.sumarDias(M.fechaDe(anno, mes, M.diasDelMes(anno, mes)), 1)};
}
function mesesAtras(anno, mes, n){ const t = anno*12 + (mes-1) - n; return {anno: Math.floor(t/12), mes: t % 12 + 1}; }

/////Semaforo del mes en curso: 'adelantado' si su % va igual o por encima de lo que ya paso del
/////mes, 'justo' si va hasta estos puntos por debajo, 'atrasado' si va mas abajo
const MARGEN_SEMAFORO = 10;

/////Las metas de un mes: {codusu: {tipo, meta}}
async function metasDelMes(conexion, anno, mes){
    const r = await ejecutar(conexion,
        `select rtrim(codven), upper(rtrim(diferenciador)), monto from tbl_api_vendedores_meta
         where anno=@anno and mes=@mes and monto>0`,
        [{nombre:'anno',tipo:TYPES.Int,valor:anno},{nombre:'mes',tipo:TYPES.Int,valor:mes}]);
    const metas = {};
    r.rows.forEach(f=>{ metas[texto(f[0].value)] = {tipo:texto(f[1].value), meta:Number(f[2].value)}; });
    return metas;
}

/////Los vendedores del grupo 20 registrados en la intranet, con su tipo de hoy y si estan activos
async function vendedoresDelGrupo(conexion){
    const r = await ejecutar(conexion,
        `select rtrim(u.codusu), rtrim(u.codven), rtrim(u.nomusu),
                (select top 1 upper(rtrim(d.diferenciador)) from tbl_api_vendedores_diferenciador d where rtrim(d.codusu)=rtrim(u.codusu)),
                case when u.estado=1 then 1 else 0 end
         from fcu0000 u
         where rtrim(u.codgru)=@grupo
           and exists(select 1 from tbl_api_vendedores_diferenciador d where rtrim(d.codusu)=rtrim(u.codusu))`,
        [{nombre:'grupo',tipo:TYPES.VarChar,valor:GRUPO_VENDEDORES}]);
    return r.rows.map(f=>{
        const v = f.map(c=>c.value);
        return {codusu:texto(v[0]), codven:texto(v[1]), nombre:texto(v[2]), tipo:texto(v[3]), activo:v[4] === 1};
    });
}

/////GET /zona/avance?anno=2026&mes=9
let zona_avance = (resolve,reject,conexion,galleta,cuerpo)=>{
    soloLectura(resolve, reject, conexion, 'zona avance', async ()=>{
        const t = await ahora(conexion);
        const periodo = leerPeriodo(cuerpo, t, MESES_HISTORIA_ZONA);
        if(!periodo) return {rechazo:"periodo invalido"};
        const actual = periodo.anno === t.anno && periodo.mes === t.mes;
        const {inicio, fin} = limitesDe(periodo.anno, periodo.mes);
        const previo = mesesAtras(periodo.anno, periodo.mes, 1);
        const limitesPrevio = limitesDe(previo.anno, previo.mes);
        const esperado = actual ? Math.round(t.dia / M.diasDelMes(t.anno, t.mes) * 1000) / 10 : 100;

        const metas = await metasDelMes(conexion, periodo.anno, periodo.mes);
        const metasPrevias = await metasDelMes(conexion, previo.anno, previo.mes);
        const grupo = await vendedoresDelGrupo(conexion);

        /////desde el mes anterior (como cerro cada uno); en el mes en curso, ademas, la historia
        /////de 90 dias para la probabilidad y la proyeccion
        const desde = actual ? [M.sumarDias(t.hoy, -DIAS_HISTORIA_PROBABILIDAD), limitesPrevio.inicio].sort()[0] : limitesPrevio.inicio;
        const mapas = await ventasDiarias(conexion, desde, fin);
        const diasEmpresa = actual ? await diasConVentas(conexion, desde, M.sumarDias(t.hoy, 1)) : [];

        let ventasHasta = null;
        /////lo comun a los que tienen cuota y a los que no
        const base = (v, tipo, meta)=>{
            const ventas = ventasDe(mapas, tipo, v.codven);
            Object.keys(ventas).forEach(d=>{ if(d >= inicio && d < fin && (!ventasHasta || d > ventasHasta)) ventasHasta = d; });
            const avance = sumarEntre(ventas, inicio, fin);
            const fila = {codusu: v.codusu, codven: v.codven, nombre: v.nombre, tipo: tipo || null,
                          avance: M.redondear(avance), hoy: null, proyeccion: null};
            let p = null;
            if(actual){
                fila.hoy = M.redondear(ventas[t.hoy] || 0);
                p = M.probabilidadAlCorte({ventas, diasEmpresa, meta, corte: t.hoy,
                                           diasHistoria: DIAS_HISTORIA_PROBABILIDAD, semilla: `${v.codusu}|${t.hoy}`});
                fila.proyeccion = p.escenarios ? p.escenarios.probable : null;
            }
            return {fila, avance, p};
        };

        const porCodusu = {};
        grupo.forEach(v=>{ porCodusu[v.codusu] = v; });
        /////los que registraron cuota y siguen en el grupo 20
        const vendedores = Object.keys(metas).filter(c=>porCodusu[c]).map(codusu=>{
            const v = porCodusu[codusu], m = metas[codusu];
            const {fila, avance, p} = base(v, m.tipo, m.meta);
            const porcentajeV = porcentaje(avance, m.meta);
            const logro = avance >= m.meta;
            const antes = metasPrevias[codusu];
            const cierreAntes = antes ? sumarEntre(ventasDe(mapas, antes.tipo, v.codven), limitesPrevio.inicio, limitesPrevio.fin) : null;
            return Object.assign(fila, {
                meta: M.redondear(m.meta), porcentaje: porcentajeV,
                falta: M.redondear(Math.max(m.meta - avance, 0)), logro,
                estado: !actual ? null : logro ? 'logrado' : porcentajeV >= esperado ? 'adelantado'
                      : porcentajeV >= esperado - MARGEN_SEMAFORO ? 'justo' : 'atrasado',
                probabilidad: p ? p.probabilidad : null, motivo: p ? p.motivo : null,
                mesAnterior: antes ? {meta: M.redondear(antes.meta), avance: M.redondear(cierreAntes),
                                      porcentaje: porcentaje(cierreAntes, antes.meta), logro: cierreAntes >= antes.meta} : null
            });
        });
        vendedores.sort((a,b)=>(b.porcentaje - a.porcentaje) || a.nombre.localeCompare(b.nombre));

        /////los del grupo 20 registrados en la intranet, activos, que no registraron cuota ese mes
        const sinCuota = grupo.filter(v=>v.activo && !metas[v.codusu]).map(v=>base(v, v.tipo, null).fila);
        sinCuota.sort((a,b)=>(b.avance - a.avance) || a.nombre.localeCompare(b.nombre));

        const suma = (lista, campo)=>M.redondear(lista.reduce((s,v)=>s + (v[campo] || 0), 0));
        const meta = suma(vendedores, 'meta'), avance = suma(vendedores, 'avance');
        const estados = {logrado:0, adelantado:0, justo:0, atrasado:0};
        vendedores.forEach(v=>{ if(v.estado) estados[v.estado]++; });
        return {
            anno: periodo.anno, mes: periodo.mes, actual: actual,
            /////hasta cuando hay facturas en el mes, y a que hora se leyo: la pantalla puede refrescar
            ventasHasta: ventasHasta, actualizado: t.momento,
            /////cuanto del mes ya paso: la marca sobre la barra (100 en un mes cerrado), igual que en
            /////la pantalla de cuota del vendedor
            esperado: esperado,
            total: {vendedores: vendedores.length, meta, avance, porcentaje: porcentaje(avance, meta),
                    logrados: vendedores.filter(v=>v.logro).length,
                    hoy: actual ? suma(vendedores, 'hoy') : null,
                    estados: actual ? estados : null,
                    sinCuota: sinCuota.length},
            vendedores,
            sinCuota
        };
    });
}

/////GET /zona/probabilidad?codusu=196
let zona_probabilidad = (resolve,reject,conexion,galleta,cuerpo)=>{
    soloLectura(resolve, reject, conexion, 'zona probabilidad', async ()=>{
        const codusu = texto(cuerpo ? cuerpo.codusu : null);
        if(!codusu) return {rechazo:"vendedor requerido"};
        const t = await ahora(conexion);

        const rv = await ejecutar(conexion,
            `select rtrim(u.codusu), rtrim(u.codven), rtrim(u.nomusu),
                    (select top 1 rtrim(d.diferenciador) from tbl_api_vendedores_diferenciador d where rtrim(d.codusu)=rtrim(u.codusu))
             from fcu0000 u where rtrim(u.codusu)=@codusu and rtrim(u.codgru)=@grupo`,
            [{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu},{nombre:'grupo',tipo:TYPES.VarChar,valor:GRUPO_VENDEDORES}]);
        if(rv.rows.length === 0) return {rechazo:"vendedor desconocido"};
        const v = rv.rows[0].map(c=>c.value);
        const vendedor = {codusu:texto(v[0]), codven:texto(v[1]), nombre:texto(v[2]), tipo:texto(v[3]).toUpperCase() || null};

        /////el mes en curso y los anteriores, cada uno "a la altura" de hoy (el mismo dia del mes)
        const meses = [];
        for(let n = 0; n <= MESES_COMPARAR_PROBABILIDAD; n++){
            const p = mesesAtras(t.anno, t.mes, n);
            p.corte = M.fechaDe(p.anno, p.mes, Math.min(t.dia, M.diasDelMes(p.anno, p.mes)));
            meses.push(p);
        }
        const masAntiguo = meses[meses.length - 1];
        const rm = await ejecutar(conexion,
            `select anno, mes, rtrim(diferenciador), monto from tbl_api_vendedores_meta
             where codven=@codusu and anno*12+mes between @desde and @hasta`,
            [{nombre:'codusu',tipo:TYPES.VarChar,valor:vendedor.codusu},
             {nombre:'desde',tipo:TYPES.Int,valor:masAntiguo.anno*12 + masAntiguo.mes},
             {nombre:'hasta',tipo:TYPES.Int,valor:t.anno*12 + t.mes}]);
        const metas = {};
        rm.rows.forEach(f=>{ const x = f.map(c=>c.value); metas[`${x[0]}-${x[1]}`] = {tipo:texto(x[2]).toUpperCase(), meta:Number(x[3])}; });

        const desde = M.sumarDias(masAntiguo.corte, -DIAS_HISTORIA_PROBABILIDAD);
        const manana = M.sumarDias(t.hoy, 1);
        const mapas = await ventasDiarias(conexion, desde, manana, vendedor.codven);
        const diasEmpresa = await diasConVentas(conexion, desde, manana);

        return {
            vendedor, hoy: t.hoy, actualizado: t.momento,
            meses: meses.map((p, n)=>{
                const registrada = metas[`${p.anno}-${p.mes}`];
                const tipo = registrada ? registrada.tipo : vendedor.tipo;
                const meta = registrada && registrada.meta > 0 ? registrada.meta : null;
                const ventas = ventasDe(mapas, tipo, vendedor.codven);
                const r = M.probabilidadAlCorte({ventas, diasEmpresa, meta, corte: p.corte,
                                                 diasHistoria: DIAS_HISTORIA_PROBABILIDAD, semilla: `${vendedor.codusu}|${p.corte}`});
                const {inicio, fin} = limitesDe(p.anno, p.mes);
                const cierre = n === 0 ? null : sumarEntre(ventas, inicio, fin);
                return {
                    anno: p.anno, mes: p.mes, actual: n === 0, tipo, meta: M.redondear(meta), corte: p.corte,
                    /////todo "al corte": lo facturado del 1 hasta ese dia incluido
                    avance: r.avance, porcentaje: porcentaje(r.avance, meta),
                    falta: meta == null ? null : M.redondear(Math.max(meta - r.avance, 0)),
                    quedan: r.quedan, ritmo: r.ritmo,
                    probabilidad: r.probabilidad, escenarios: r.escenarios, motivo: r.motivo,
                    /////como termino de verdad ese mes (null en el mes en curso)
                    cierre: cierre == null ? null : {avance: M.redondear(cierre), porcentaje: porcentaje(cierre, meta),
                                                     logro: meta == null ? null : cierre >= meta}
                };
            })
        };
    });
}

module.exports={zona_avance, zona_probabilidad}
