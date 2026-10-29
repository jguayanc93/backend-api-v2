const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, soloLectura} = require('../marcas/comun')
const {leerPeriodo} = require('../marcas/ventas')
const M = require('./modelo')
const R = require('./regla')
const Z = require('./zona')
const {MESES_HISTORIA_ZONA} = require('../../funciones/comunes/constantes')

/////Jefe de zona (grupo 34): los clientes de un vendedor del grupo 20 en un mes. Dos acciones:
/////  GET /zona/cartera?codusu=269    un vendedor de CARTERA: su cartera, cuantos atendio y cuantos no
/////  GET /zona/cobertura?codusu=399  un vendedor de COBERTURA: a quienes facturo, de quien eran,
/////                                  cuantos de sus asignados atendio y cuantos clientes nuevos trajo
/////Que venta le cuenta a cada uno: querys/zona/regla.js. La venta de un vendedor aqui es la
/////misma cifra que su avance. Contrato: docs/zona-grupo34.md
/////
/////Asignados: los que hoy tiene en mst01cli (estado<>0) mas los que figuran a su nombre en las
/////facturas del mes (mst01fac.codven). mst01cli no guarda historia: en un mes anterior se
/////completa con las facturas, pero un cliente que tuvo y no compro ese mes no se puede saber.
/////Atendido: le quedo venta mayor a 0 en el mes; uno que solo tuvo notas de credito no cuenta.

const MESES_ANTES = 3;           ////riesgo, promedio y comparacion: los 3 meses anteriores
const MESES_NUEVO = 12;          ////cliente nuevo: sin facturas ni boletas en la empresa en 12 meses
const TOP_CONCENTRACION = 5;

const DOCUMENTO = (a)=>`${a}.cdocu in ('01','03')`;     ////factura o boleta, no nota de credito

const parametroFecha = (nombre, f)=>({nombre, tipo:TYPES.VarChar, valor:f.replace(/-/g,'')});
const r2 = M.redondear;

/////El vendedor y su tipo en el mes: el de la cuota que registro, o el de hoy si no registro
async function vendedorDelMes(conexion, codusu, anno, mes){
    const rv = await ejecutar(conexion,
        `select rtrim(u.codusu), rtrim(u.codven), rtrim(u.nomusu),
                (select top 1 upper(rtrim(d.diferenciador)) from tbl_api_vendedores_diferenciador d where rtrim(d.codusu)=rtrim(u.codusu)),
                (select top 1 upper(rtrim(m.diferenciador)) from tbl_api_vendedores_meta m where m.codven=@codusu and m.anno=@anno and m.mes=@mes)
         from fcu0000 u where rtrim(u.codusu)=@codusu and rtrim(u.codgru)=@grupo`,
        [{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu},{nombre:'grupo',tipo:TYPES.VarChar,valor:Z.GRUPO_VENDEDORES},
         {nombre:'anno',tipo:TYPES.Int,valor:anno},{nombre:'mes',tipo:TYPES.Int,valor:mes}]);
    if(rv.rows.length === 0) return null;
    const v = rv.rows[0].map(c=>texto(c.value));
    return {codusu:v[0], codven:v[1], nombre:v[2], tipo:v[4] || v[3] || null};
}

/////Todo lo que facturo el, y todo lo facturado a clientes a su nombre, por cliente y dia
async function movimientos(conexion, codven, desde, hasta){
    const r = await ejecutar(conexion,
        `select rtrim(f.codcli), convert(char(10), f.fecha, 23), rtrim(f.codven), rtrim(f.codven_usu),
                sum(${R.MONTO('f')}), count(distinct case when ${DOCUMENTO('f')} then f.cdocu+f.ndocu end)
         from mst01fac f
         where f.fecha>=@desde and f.fecha<@hasta and ${R.VALIDA('f')}
           and (f.codven_usu=@codven or f.codven=@codven)
         group by f.codcli, f.fecha, f.codven, f.codven_usu`,
        [parametroFecha('desde',desde), parametroFecha('hasta',hasta), {nombre:'codven',tipo:TYPES.VarChar,valor:codven}]);
    return r.rows.map(f=>{
        const v = f.map(c=>c.value);
        return {codcli:texto(v[0]), dia:texto(v[1]), dueno:texto(v[2]) || null, quien:texto(v[3]) || null,
                monto:Number(v[4] || 0), docs:Number(v[5] || 0)};
    });
}

/////Los clientes que hoy tiene asignados y los que aparecen en sus movimientos: nombre y dueño de hoy.
/////Con union y no con un or: el or con la subconsulta tardaba 6 segundos en vez de 0,2.
const FICHA = `select rtrim(c.codcli), rtrim(c.nomcli), rtrim(c.codven), case when c.estado<>0 then 1 else 0 end from mst01cli c`;
async function fichas(conexion, codven, desde, hasta){
    const r = await ejecutar(conexion,
        `${FICHA} where rtrim(c.codven)=@codven and c.estado<>0
         union
         ${FICHA} where c.codcli in (select f.codcli from mst01fac f where f.fecha>=@desde and f.fecha<@hasta
                                     and (f.codven_usu=@codven or f.codven=@codven))`,
        [parametroFecha('desde',desde), parametroFecha('hasta',hasta), {nombre:'codven',tipo:TYPES.VarChar,valor:codven}]);
    const salida = {};
    r.rows.forEach(f=>{
        const v = f.map(c=>c.value);
        salida[texto(v[0])] = {nombre:texto(v[1]), duenoHoy:texto(v[2]) || null, activo:v[3] === 1};
    });
    return salida;
}

/////De los clientes que atendio en el mes, los que tuvieron factura o boleta en la empresa
/////en los 12 meses anteriores: los demas son nuevos
async function conHistoria(conexion, codven, periodo, inicio, fin){
    const p = Z.mesesAtras(periodo.anno, periodo.mes, MESES_NUEVO);
    const r = await ejecutar(conexion,
        `select distinct f.codcli from mst01fac f
         where f.fecha>=@antes and f.fecha<@inicio and f.flag<>'*' and ${DOCUMENTO('f')}
           and f.codcli in (select g.codcli from mst01fac g where g.codven_usu=@codven and g.fecha>=@inicio and g.fecha<@fin)`,
        [parametroFecha('antes', Z.limitesDe(p.anno, p.mes).inicio),
         parametroFecha('inicio',inicio), parametroFecha('fin',fin), {nombre:'codven',tipo:TYPES.VarChar,valor:codven}]);
    return new Set(r.rows.map(f=>texto(f[0].value)));
}

/////El esqueleto comun de las dos acciones: periodo, vendedor, movimientos y lo que le cuenta
async function preparar(conexion, cuerpo, tipoPedido){
    const codusu = texto(cuerpo ? cuerpo.codusu : null);
    if(!codusu) return {rechazo:"vendedor requerido"};
    const t = await Z.ahora(conexion);
    const periodo = leerPeriodo(cuerpo, t, MESES_HISTORIA_ZONA);
    if(!periodo) return {rechazo:"periodo invalido"};
    const vendedor = await vendedorDelMes(conexion, codusu, periodo.anno, periodo.mes);
    if(!vendedor) return {rechazo:"vendedor desconocido"};
    if(vendedor.tipo !== tipoPedido) return {rechazo:"vendedor de otro tipo"};

    const actual = periodo.anno === t.anno && periodo.mes === t.mes;
    const {inicio, fin} = Z.limitesDe(periodo.anno, periodo.mes);
    /////el mes y los 3 anteriores, cada uno con su corte: en el mes en curso, hoy y el mismo dia
    /////de los anteriores; en un mes cerrado, el mes entero
    const meses = [];
    for(let n = 0; n <= MESES_ANTES; n++){
        const p = Z.mesesAtras(periodo.anno, periodo.mes, n);
        const l = Z.limitesDe(p.anno, p.mes);
        const ultimo = M.diasDelMes(p.anno, p.mes);
        meses.push({anno:p.anno, mes:p.mes, inicio:l.inicio, fin:l.fin,
                    corte:M.fechaDe(p.anno, p.mes, actual ? Math.min(t.dia, ultimo) : ultimo)});
    }
    const desde = meses[MESES_ANTES].inicio;

    const deCartera = await R.carteras(conexion);
    const filas = await movimientos(conexion, vendedor.codven, desde, fin);
    const ficha = await fichas(conexion, vendedor.codven, desde, fin);
    const {reemplazadoPor, reemplazaA} = await Z.reemplazosDelMes(conexion, inicio, fin);

    const cuenta = (f)=>f.quien === vendedor.codven && (tipoPedido === 'COBERTURA' || deCartera.has(f.dueno));
    const enMes = (f)=>f.dia >= inicio && f.dia < fin;

    /////por cliente: lo que le cuenta en el mes y en cada mes anterior, sus documentos, su ultima
    /////compra con el, lo que le facturaron otros en el mes y de quien era el cliente en el mes
    const clientes = {};
    const de = (codcli)=>clientes[codcli] = clientes[codcli] || {codcli, venta:0, docs:0, previos:[0,0,0], ultimaCompra:null,
                                                                   otros:{}, duenos:{}, deEl:false,
                                                                   fuera:{venta:0, docs:0, duenos:{}}};
    filas.forEach(f=>{
        if(cuenta(f)){
            const c = de(f.codcli);
            if(enMes(f)){ c.venta += f.monto; c.docs += f.docs; c.duenos[f.dueno || ''] = (c.duenos[f.dueno || ''] || 0) + f.monto; }
            else{
                const n = meses.findIndex(m=>f.dia >= m.inicio && f.dia < m.fin);
                if(n > 0) c.previos[n-1] += f.monto;
            }
            if(f.docs > 0 && (!c.ultimaCompra || f.dia > c.ultimaCompra)) c.ultimaCompra = f.dia;
        }
        else if(enMes(f) && f.dueno === vendedor.codven){
            const c = de(f.codcli);
            c.otros[f.quien || ''] = (c.otros[f.quien || ''] || 0) + f.monto;
        }
        /////CARTERA: lo que facturo el a clientes que no son de cartera (de cobertura, de la oficina
        /////o de nadie). No le cuenta a nadie; se devuelve para que el jefe lo vea
        else if(enMes(f) && f.quien === vendedor.codven){
            const c = de(f.codcli).fuera;
            c.venta += f.monto; c.docs += f.docs; c.duenos[f.dueno || ''] = (c.duenos[f.dueno || ''] || 0) + f.monto;
        }
        if(enMes(f) && f.dueno === vendedor.codven) de(f.codcli).deEl = true;
    });
    /////los asignados de hoy, aunque no tengan ningun movimiento
    Object.keys(ficha).forEach(codcli=>{
        if(ficha[codcli].duenoHoy === vendedor.codven && ficha[codcli].activo) de(codcli);
    });

    const codvens = [];
    Object.values(clientes).forEach(c=>{ codvens.push(...Object.keys(c.otros), ...Object.keys(c.duenos), ...Object.keys(c.fuera.duenos)); });
    const nombre = await R.nombres(conexion, codvens);

    /////la comparacion: en cada mes, hasta su corte, cuantos clientes le dejaron venta y cuanto. En
    /////CARTERA, ademas, cuantos clientes libres atendio (cuentan como clientes, no como monto)
    const comparacion = meses.map(m=>{
        const porCliente = {}, libres = {};
        filas.forEach(f=>{
            if(f.dia < m.inicio || f.dia > m.corte) return;
            if(cuenta(f)) porCliente[f.codcli] = (porCliente[f.codcli] || 0) + f.monto;
            else if(f.quien === vendedor.codven && R.esLibre(f.dueno)) libres[f.codcli] = (libres[f.codcli] || 0) + f.monto;
        });
        const montos = Object.values(porCliente);
        const salida = {anno:m.anno, mes:m.mes, corte:m.corte, clientes:montos.filter(x=>x > 0).length,
                        venta:r2(montos.reduce((s,x)=>s + x, 0))};
        if(tipoPedido === 'CARTERA') salida.libres = Object.values(libres).filter(x=>x > 0).length;
        return salida;
    });

    return {t, periodo, actual, inicio, fin, vendedor, clientes, ficha, nombre, deCartera, comparacion,
            reemplazadoPor:reemplazadoPor[vendedor.codven] || null, reemplazaA:reemplazaA[vendedor.codven] || []};
}

/////una fila de cliente para la respuesta
function fila(c, base, extra){
    const ficha = base.ficha[c.codcli] || {};
    const promedio = c.previos.reduce((s,x)=>s + x, 0) / MESES_ANTES;
    const otros = Object.keys(c.otros).map(q=>({codven:q || null, nombre:base.nombre[q] || null, venta:r2(c.otros[q])}))
        .sort((a,b)=>b.venta - a.venta);
    return Object.assign({
        codcli: c.codcli, nombre: ficha.nombre || null,
        venta: r2(c.venta), docs: c.docs, atendido: c.venta > 0,
        ultimaCompra: c.ultimaCompra, promedioMensual: r2(promedio),
        /////lo que otros le facturaron en el mes a este cliente suyo: no le cuenta
        otros: otros
    }, extra);
}

/////compro con el en alguno de los 3 meses anteriores y en este todavia no
function enRiesgo(c){ return c.venta <= 0 && c.previos.some(x=>x > 0); }

function riesgoDe(lista, base){
    const filas = lista.filter(enRiesgo).map(c=>fila(c, base, {mesesConCompra: c.previos.filter(x=>x > 0).length}))
        .sort((a,b)=>(b.promedioMensual - a.promedioMensual) || String(a.nombre).localeCompare(String(b.nombre)));
    return {clientes: filas.length, promedioMensual: r2(filas.reduce((s,f)=>s + f.promedioMensual, 0)), lista: filas};
}

function concentracion(lista, venta){
    const top = lista.map(c=>c.venta).filter(x=>x > 0).sort((a,b)=>b - a).slice(0, TOP_CONCENTRACION);
    const suma = top.reduce((s,x)=>s + x, 0);
    return {clientes: top.length, venta: r2(suma), porcentaje: venta > 0 ? Z.porcentaje(suma, venta) : null};
}

function cabecera(base){
    return {
        vendedor: base.vendedor, anno: base.periodo.anno, mes: base.periodo.mes, actual: base.actual,
        corte: base.comparacion[0].corte, actualizado: base.t.momento,
        reemplazadoPor: base.reemplazadoPor, reemplazaA: base.reemplazaA
    };
}

/////GET /zona/cartera?codusu=269&anno=2026&mes=10
let zona_cartera = (resolve,reject,conexion,galleta,cuerpo)=>{
    soloLectura(resolve, reject, conexion, 'zona cartera', async ()=>{
        const base = await preparar(conexion, cuerpo, 'CARTERA');
        if(base.rechazo) return base;
        const yo = base.vendedor.codven;
        const todos = Object.values(base.clientes);

        /////suyos: asignados hoy o a su nombre en las facturas del mes. Los demas que le cuentan son
        /////de otra cartera: los atendio reemplazando a un compañero
        const esSuyo = (c)=>c.deEl || (base.ficha[c.codcli] && base.ficha[c.codcli].duenoHoy === yo && base.ficha[c.codcli].activo);
        const suyos = todos.filter(esSuyo);
        const ajenos = todos.filter(c=>!esSuyo(c) && (c.venta !== 0 || c.docs > 0));

        const venta = todos.reduce((s,c)=>s + c.venta, 0);
        const atendidos = suyos.filter(c=>c.venta > 0).length;
        const filaSuya = (c)=>fila(c, base, {suyo:true, enCarteraHoy: !!(base.ficha[c.codcli] && base.ficha[c.codcli].duenoHoy === yo), dueno:null});
        const filaAjena = (c)=>{
            const d = Object.keys(c.duenos).sort((a,b)=>c.duenos[b] - c.duenos[a])[0] || null;
            return fila(c, base, {suyo:false, enCarteraHoy:false, dueno: d ? {codven:d, nombre:base.nombre[d] || null} : null});
        };
        const orden = (a,b)=>(b.venta - a.venta) || String(a.nombre).localeCompare(String(b.nombre));

        /////libre: de la oficina o sin dueño. Cuenta como cliente atendido, no como monto
        const fuera = todos.filter(c=>c.fuera.venta !== 0 || c.fuera.docs > 0).map(c=>{
            const d = Object.keys(c.fuera.duenos).sort((a,b)=>c.fuera.duenos[b] - c.fuera.duenos[a])[0] || null;
            const libre = R.esLibre(d);
            return {codcli: c.codcli, nombre: (base.ficha[c.codcli] || {}).nombre || null,
                    venta: r2(c.fuera.venta), docs: c.fuera.docs,
                    dueno: d ? {codven: d, nombre: base.nombre[d] || null} : null,
                    libre, atendido: libre && c.fuera.venta > 0};
        }).sort(orden);
        const libres = fuera.filter(c=>c.libre), conDueno = fuera.filter(c=>!c.libre);
        const libresAtendidos = libres.filter(c=>c.atendido).length;
        const reemplazoAtendidos = ajenos.filter(c=>c.venta > 0).length;
        const sumaVenta = (lista)=>r2(lista.reduce((s,c)=>s + c.venta, 0));

        return Object.assign(cabecera(base), {
            resumen: {
                asignados: suyos.length, atendidos, sinAtender: suyos.length - atendidos,
                porcentaje: Z.porcentaje(atendidos, suyos.length),
                /////la misma cifra que su avance
                venta: r2(venta),
                ventaPropia: r2(suyos.reduce((s,c)=>s + c.venta, 0)),
                ventaReemplazo: r2(ajenos.reduce((s,c)=>s + c.venta, 0)),
                ventaDeOtros: r2(suyos.reduce((s,c)=>s + Object.values(c.otros).reduce((x,y)=>x + y, 0), 0)),
                /////lo que facturo el a clientes que no son de cartera: el monto no le cuenta a nadie
                ventaFueraDeCartera: {clientes: fuera.length, venta: sumaVenta(fuera),
                                      libres: {clientes: libres.length, atendidos: libresAtendidos, venta: sumaVenta(libres)},
                                      conDueno: {clientes: conDueno.length, venta: sumaVenta(conDueno)}},
                /////cuantos clientes atendio en total, para su cobertura de clientes: los suyos, los de
                /////un compañero de cartera y los libres (estos sin monto)
                coberturaClientes: {total: atendidos + reemplazoAtendidos + libresAtendidos,
                                    cartera: atendidos, reemplazo: reemplazoAtendidos, libres: libresAtendidos},
                concentracion: concentracion(todos, venta)
            },
            comparacion: base.comparacion,
            riesgo: riesgoDe(suyos, base),
            clientes: suyos.map(filaSuya).sort(orden),
            reemplazo: ajenos.map(filaAjena).sort(orden),
            fueraDeCartera: fuera
        });
    });
}

/////GET /zona/cobertura?codusu=399&anno=2026&mes=10
let zona_cobertura = (resolve,reject,conexion,galleta,cuerpo)=>{
    soloLectura(resolve, reject, conexion, 'zona cobertura', async ()=>{
        const base = await preparar(conexion, cuerpo, 'COBERTURA');
        if(base.rechazo) return base;
        const yo = base.vendedor.codven;
        const todos = Object.values(base.clientes);
        const historia = await conHistoria(conexion, yo, base.periodo, base.inicio, base.fin);

        /////de quien era el cliente en sus facturas del mes (si hay varias, el de mas venta)
        const duenoDe = (c)=>Object.keys(c.duenos).sort((a,b)=>c.duenos[b] - c.duenos[a])[0] || null;
        const tipoDueno = (d)=>d === yo ? 'propio' : base.deCartera.has(d) ? 'cartera' : R.esLibre(d) ? 'libre' : 'otro';

        const facturados = todos.filter(c=>c.venta !== 0 || c.docs > 0);
        const atendidos = facturados.filter(c=>c.venta > 0);
        const esAsignado = (c)=>c.deEl || (base.ficha[c.codcli] && base.ficha[c.codcli].duenoHoy === yo && base.ficha[c.codcli].activo);
        const asignados = todos.filter(esAsignado);
        const asignadosAtendidos = asignados.filter(c=>c.venta > 0).length;
        const venta = todos.reduce((s,c)=>s + c.venta, 0);

        const porDueno = {propio:{clientes:0, venta:0}, cartera:{clientes:0, venta:0}, libre:{clientes:0, venta:0}, otro:{clientes:0, venta:0}};
        atendidos.forEach(c=>{ const g = porDueno[tipoDueno(duenoDe(c))]; g.clientes++; g.venta += c.venta; });
        Object.values(porDueno).forEach(g=>{ g.venta = r2(g.venta); });

        const nuevos = atendidos.filter(c=>!historia.has(c.codcli));

        const filaCliente = (c)=>{
            const d = duenoDe(c);
            return fila(c, base, {
                dueno: d ? {codven:d, nombre:base.nombre[d] || null, tipo:tipoDueno(d)} : null,
                nuevo: c.venta > 0 && !historia.has(c.codcli)
            });
        };
        /////en riesgo solo los que no son de la cartera de nadie: los clientes de cartera los cuida su
        /////dueño, aunque el los haya atendido un tiempo (reemplazos)
        const cuidaEl = (c)=>{ const f = base.ficha[c.codcli]; return !(f && f.duenoHoy && base.deCartera.has(f.duenoHoy)); };

        return Object.assign(cabecera(base), {
            resumen: {
                atendidos: atendidos.length, porDueno,
                asignados: asignados.length, asignadosAtendidos, asignadosSinAtender: asignados.length - asignadosAtendidos,
                porcentajeAsignados: Z.porcentaje(asignadosAtendidos, asignados.length),
                /////la misma cifra que su avance
                venta: r2(venta),
                nuevos: {clientes: nuevos.length, venta: r2(nuevos.reduce((s,c)=>s + c.venta, 0))},
                concentracion: concentracion(todos, venta)
            },
            comparacion: base.comparacion,
            riesgo: riesgoDe(todos.filter(cuidaEl), base),
            /////solo los que facturo en el mes: los asignados sin atender pueden ser miles (2 530 en un caso)
            clientes: facturados.map(filaCliente).sort((a,b)=>(b.venta - a.venta) || String(a.nombre).localeCompare(String(b.nombre)))
        });
    });
}

module.exports={zona_cartera, zona_cobertura}
