const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto} = require('../marcas/comun')
const R = require('../zona/regla')
const candidatos = require('./candidatos')
const {SUGERIDOS_REPONER, SUGERIDOS_LLAMAR, GRUPO_ROTACION_HOY, CLIENTES_EXCLUIDOS_HOY, DIAS_REACTIVAR_HOY} = require('../../funciones/comunes/constantes')

/////¿A quien vender hoy? Contrato: docs/quienvender-grupo20.md
/////
/////Cada dia el vendedor recibe 3 clientes: SUGERIDOS_REPONER para reponer y SUGERIDOS_LLAMAR para
/////llamar. La primera vez que abre el modulo en el dia se calculan y se graban en tbl_api_quienvender
/////(querys/sp/quienvender.sql); el resto del dia recibe los mismos. No hay boton de cambiar.
/////
/////Como se eligen (los candidatos y sus reglas estan en querys/hoy/candidatos.js):
/////  - se toman los GRUPO_ROTACION_HOY clientes de mas valor de cada lista (reponer, llamar) y entre ellos
/////    sale primero el que hace mas tiempo que no se le sugiere a este vendedor, sea por lo que sea. Con 10
/////    y 2 por dia, un cliente de reponer vuelve a salir a los 5 dias y uno de llamar a los 10
/////  - si un cupo queda vacio se llena con el respaldo, en este orden: el resto de reponer, el resto de
/////    llamar, reactivar, asignados sin compras y, solo para cobertura, clientes libres. Nunca hay un
/////    cupo fijo de "explorar"
/////  - nunca los clientes inactivos ni los de CLIENTES_EXCLUIDOS_HOY (la propia empresa y fabricantes)
/////
/////Las marcas cotizo / pidio / facturo se llenan solo cuando el vendedor abre el modulo en un dia
/////posterior, que le cierra los dias anteriores. Valen para el mismo dia de la sugerencia. No hay
/////proceso nocturno, y el dia de hoy nunca esta cerrado.
/////
/////Nada de esto tumba la entrega: si la tabla no existe o no se puede grabar o cerrar, el vendedor recibe
/////su lista igual (sin memoria entre dias) y el fallo queda en el log, como la auditoria.

const TIPOS_VENDEDOR = ['CARTERA','COBERTURA'];
const PUESTOS_REPONER = Array.from({length:SUGERIDOS_REPONER}, (_,i)=>i + 1);
const PUESTOS_LLAMAR = Array.from({length:SUGERIDOS_LLAMAR}, (_,i)=>SUGERIDOS_REPONER + i + 1);
const PRODUCTOS_REPONER = 5;     ////los productos que se muestran en la tarjeta de reponer
const RESPALDO_CLIENTES = 50;    ////cuantos clientes se traen para los respaldos de mas abajo
/////mst01cot tipo 31, mst01ped tipo 32, mst01fac facturas y boletas 01 y 03
const DOCUMENTO_COTIZACION = '31';
const DOCUMENTO_PEDIDO = '32';

/////por que se le sugiere, en una frase corta
const MOTIVOS = {
    REPONER: 'Productos que suele comprar y ya le tocan',
    LLAMAR: 'Compro el mes pasado y este mes todavia no',
    REACTIVAR: `Hace mas de ${DIAS_REACTIVAR_HOY} dias que no compra`,
    SIN_COMPRAS: 'Cliente tuyo sin compras en el ultimo año',
    LIBRE: 'Cliente libre que compro en el ultimo año'
};

const conFormato = (aaaammdd)=>`${aaaammdd.slice(0,4)}-${aaaammdd.slice(4,6)}-${aaaammdd.slice(6,8)}`;

/////Quien pregunta: su codven (el de las facturas) y si es de cartera o de cobertura
async function quienPregunta(conexion, galleta){
    const codven = texto(galleta ? galleta.codigo : null);
    const codusu = texto(galleta ? galleta.identificador : null);
    if(!codven || !codusu) return {rechazo:"no identificado"};
    const r = await ejecutar(conexion,
        `select top 1 upper(rtrim(diferenciador)) from tbl_api_vendedores_diferenciador where rtrim(codusu)=@codusu`,
        [{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu}]);
    const tipo = r.rows.length ? texto(r.rows[0][0].value) : null;
    if(!TIPOS_VENDEDOR.includes(tipo)) return {rechazo:"sin permiso"};
    return {yo:{codven, codusu, tipo}};
}

/////El dia segun el servidor, como AAAAMMDD
async function hoyDelServidor(conexion){
    const r = await ejecutar(conexion, `select convert(char(8), getdate(), 112)`, []);
    return texto(r.rows[0][0].value);
}

/////donde queda lo que el vendedor hizo cada dia: [marca, tabla, tipo de documento]
const HECHOS = [
    ['cotizo',  'mst01cot', `t.cdocu='${DOCUMENTO_COTIZACION}'`],
    ['pidio',   'mst01ped', `t.cdocu='${DOCUMENTO_PEDIDO}'`],
    ['facturo', 'mst01fac', `t.cdocu in('01','03')`]
];

/////Cierra los dias anteriores del vendedor: para cada sugerencia sin cerrar, si ese mismo dia el cotizo,
/////pidio o facturo a ese cliente. Por cada dia por cerrar, una consulta por tabla con el dia como rango
/////fijo, que usa el indice de la fecha; un UPDATE con EXISTS correlacionados sobre estas tablas
/////tardaba 6,6 s para 6 filas.
async function cerrarDias(conexion, yo, hoy){
    const abiertas = await ejecutar(conexion,
        `select id, convert(char(8), fecha, 112), rtrim(codcli) from dbo.tbl_api_quienvender
         where codven=@codven and cerrado is null and fecha<CONVERT(date,@hoy,112)`,
        [{nombre:'codven',tipo:TYPES.VarChar,valor:yo.codven}, {nombre:'hoy',tipo:TYPES.VarChar,valor:hoy}]);
    if(abiertas.rows.length === 0) return;

    const filas = abiertas.rows.map(f=>({id:f[0].value, dia:texto(f[1].value), codcli:texto(f[2].value)}));
    const hechos = {};   ////{ 'AAAAMMDD': { cotizo: Set de clientes, pidio: Set, facturo: Set } }
    for(const dia of [...new Set(filas.map(f=>f.dia))]){
        hechos[dia] = {};
        for(const [marca, tabla, documento] of HECHOS){
            const r = await ejecutar(conexion,
                `select distinct rtrim(t.codcli) from ${tabla} t
                 where ${documento} and ISNULL(t.flag,'')<>'*' and t.codven_usu=@codven
                   and t.fecha>=CONVERT(date,@dia,112) and t.fecha<DATEADD(day,1,CONVERT(date,@dia,112))`,
                [{nombre:'codven',tipo:TYPES.VarChar,valor:yo.codven}, {nombre:'dia',tipo:TYPES.VarChar,valor:dia}]);
            hechos[dia][marca] = new Set(r.rows.map(x=>texto(x[0].value)));
        }
    }

    const parametros = [];
    const sentencias = filas.map((f,i)=>{
        const h = hechos[f.dia];
        parametros.push({nombre:`i${i}`,tipo:TYPES.BigInt,valor:f.id});
        parametros.push({nombre:`a${i}`,tipo:TYPES.Bit,valor:h.cotizo.has(f.codcli)});
        parametros.push({nombre:`b${i}`,tipo:TYPES.Bit,valor:h.pidio.has(f.codcli)});
        parametros.push({nombre:`c${i}`,tipo:TYPES.Bit,valor:h.facturo.has(f.codcli)});
        return `update dbo.tbl_api_quienvender set cotizo=@a${i}, pidio=@b${i}, facturo=@c${i}, cerrado=GETDATE() where id=@i${i} and cerrado is null`;
    });
    await ejecutar(conexion, sentencias.join(';\n'), parametros);
}

/////De cada cliente, la ultima fecha en que se le sugirio a este vendedor antes de hoy: {codcli: AAAA-MM-DD}
async function ultimasSugerencias(conexion, yo, hoy){
    const r = await ejecutar(conexion,
        `select rtrim(codcli), convert(char(10), max(fecha), 23) from dbo.tbl_api_quienvender
         where codven=@codven and fecha<CONVERT(date,@hoy,112) group by codcli`,
        [{nombre:'codven',tipo:TYPES.VarChar,valor:yo.codven}, {nombre:'hoy',tipo:TYPES.VarChar,valor:hoy}]);
    const mapa = new Map();
    r.rows.forEach(f=>mapa.set(texto(f[0].value), texto(f[1].value)));
    return mapa;
}

/////Las sugerencias ya grabadas de hoy, o [] si todavia no hay
async function leerDia(conexion, yo, hoy){
    const r = await ejecutar(conexion,
        `select puesto, rtrim(tipo), rtrim(codcli), rtrim(cliente), valor, detalle
         from dbo.tbl_api_quienvender where codven=@codven and fecha=CONVERT(date,@hoy,112) order by puesto`,
        [{nombre:'codven',tipo:TYPES.VarChar,valor:yo.codven}, {nombre:'hoy',tipo:TYPES.VarChar,valor:hoy}]);
    return r.rows.map(f=>{
        const v = f.map(c=>c.value);
        let d = {};
        try{ d = JSON.parse(v[5] || '{}'); }catch(e){ d = {}; }
        return tarjeta(v[0], texto(v[1]), texto(v[2]), texto(v[3]), d);
    });
}

/////Lo que ve el vendedor de cada cliente. Los campos que no aplican al tipo van en null
function tarjeta(puesto, tipo, codcli, cliente, d){
    return {
        puesto: puesto, tipo: tipo, motivo: MOTIVOS[tipo] || null, codcli: codcli, cliente: cliente,
        /////REPONER: lo vencido; LLAMAR: la media mensual; REACTIVAR y LIBRE: lo comprado en 12 meses. US$
        valorUsd: d.valorUsd == null ? null : d.valorUsd,
        ultimaCompra: d.ultimaCompra || null,
        mesesConCompra: d.mesesConCompra == null ? null : d.mesesConCompra,
        facturasMesPasado: d.facturasMesPasado == null ? null : d.facturasMesPasado,
        /////REPONER: lo que le toca (con su ritmo); LLAMAR y REACTIVAR: lo que mas lleva
        productos: d.productos || []
    };
}

/////Entre los candidatos, el que hace mas tiempo que no se sugiere (nunca sugerido = el mas antiguo); a
/////igual antiguedad, el de la lista mas arriba. Orden estable.
function porAntiguedad(lista, historia){
    return lista
        .map((c,i)=>({c, i, ultima: historia.get(c.codcli) || ''}))
        .sort((a,b)=>a.ultima < b.ultima ? -1 : a.ultima > b.ultima ? 1 : a.i - b.i)
        .map(x=>x.c);
}

const unaVez = (fn)=>{ let p = null; return ()=>p || (p = fn()); };

/////Elige los clientes del dia: [{puesto, tipo, c}]. Es la parte que se prueba con fechas pasadas.
async function elegir(conexion, yo, hoy, historia){
    const ctx = {codven:yo.codven, hoy:hoy, filtro: yo.tipo === 'CARTERA' ? ` and ${R.DE_CARTERA('f')}` : ''};
    const excluidos = new Set(CLIENTES_EXCLUIDOS_HOY);
    const valido = (c)=>c.activo && !excluidos.has(c.codcli);

    const rep = (await candidatos.reponer(conexion, ctx)).filter(valido);
    const enRep = new Set(rep.map(c=>c.codcli));
    const llam = (await candidatos.llamar(conexion, ctx)).filter(c=>valido(c) && !enRep.has(c.codcli));
    const enLlam = new Set(llam.map(c=>c.codcli));

    const usados = new Set();
    const elegidos = {};
    const tomar = (lista, tipo, puesto)=>{
        const c = porAntiguedad(lista.filter(x=>!usados.has(x.codcli)), historia)[0];
        if(!c) return false;
        usados.add(c.codcli);
        elegidos[puesto] = {puesto, tipo, c};
        return true;
    };

    const pozoRep = rep.slice(0, GRUPO_ROTACION_HOY), pozoLlam = llam.slice(0, GRUPO_ROTACION_HOY);
    PUESTOS_REPONER.forEach(puesto=>tomar(pozoRep, 'REPONER', puesto));
    PUESTOS_LLAMAR.forEach(puesto=>tomar(pozoLlam, 'LLAMAR', puesto));

    /////respaldo: solo para un cupo vacio. Los tres ultimos se traen de la base solo si hacen falta
    const vacios = PUESTOS_REPONER.concat(PUESTOS_LLAMAR).filter(puesto=>!elegidos[puesto]);
    if(vacios.length){
        const reactivar = unaVez(async()=>(await candidatos.reactivar(conexion, ctx)).filter(c=>valido(c) && !enRep.has(c.codcli) && !enLlam.has(c.codcli)));
        const sinCompras = unaVez(async()=>(await candidatos.sinCompras(conexion, ctx, RESPALDO_CLIENTES)).filter(valido));
        const libres = unaVez(async()=>yo.tipo === 'COBERTURA' ? (await candidatos.libres(conexion, ctx, RESPALDO_CLIENTES)).filter(valido) : []);
        const niveles = [
            ['REPONER', async()=>rep], ['LLAMAR', async()=>llam],
            ['REACTIVAR', reactivar], ['SIN_COMPRAS', sinCompras], ['LIBRE', libres]
        ];
        for(const puesto of vacios){
            for(const [tipo, cargar] of niveles){
                if(tomar(await cargar(), tipo, puesto)) break;
            }
        }
    }
    return {ctx, elegidos: Object.values(elegidos).sort((a,b)=>a.puesto - b.puesto)};
}

/////El detalle de cada cliente elegido: lo que se le muestra al vendedor
async function detallar(conexion, ctx, e){
    const c = e.c;
    const d = {valorUsd:null, ultimaCompra:null, mesesConCompra:null, facturasMesPasado:null, productos:[]};
    if(e.tipo === 'REPONER'){
        d.valorUsd = c.valor;
        d.productos = await candidatos.productosVencidos(conexion, ctx, c.codcli, PRODUCTOS_REPONER);
        d.ultimaCompra = d.productos.map(p=>p.ultima).sort().slice(-1)[0] || null;
    }
    else if(e.tipo === 'LLAMAR'){
        d.valorUsd = c.valor; d.ultimaCompra = c.ultimaCompra;
        d.mesesConCompra = c.mesesConCompra; d.facturasMesPasado = c.facturasMesPasado;
        d.productos = await candidatos.masLleva(conexion, ctx, c.codcli, 3);
    }
    else if(e.tipo === 'REACTIVAR'){
        d.valorUsd = c.valor; d.ultimaCompra = c.ultimaCompra;
        d.productos = await candidatos.masLleva(conexion, ctx, c.codcli, 12, false);
    }
    else if(e.tipo === 'LIBRE'){
        d.valorUsd = c.valor; d.ultimaCompra = c.ultimaCompra;
    }
    return d;
}

async function grabarDia(conexion, yo, hoy, tarjetas){
    const parametros = [
        {nombre:'hoy',tipo:TYPES.VarChar,valor:hoy},
        {nombre:'codven',tipo:TYPES.VarChar,valor:yo.codven},
        {nombre:'codusu',tipo:TYPES.VarChar,valor:yo.codusu}
    ];
    const filas = tarjetas.map((t,i)=>{
        const detalle = {valorUsd:t.valorUsd, ultimaCompra:t.ultimaCompra, mesesConCompra:t.mesesConCompra,
                         facturasMesPasado:t.facturasMesPasado, productos:t.productos};
        parametros.push({nombre:`p${i}`,tipo:TYPES.Int,valor:t.puesto});
        parametros.push({nombre:`t${i}`,tipo:TYPES.VarChar,valor:t.tipo});
        parametros.push({nombre:`c${i}`,tipo:TYPES.VarChar,valor:t.codcli});
        parametros.push({nombre:`n${i}`,tipo:TYPES.VarChar,valor:(t.cliente || '').slice(0,80)});
        parametros.push({nombre:`v${i}`,tipo:TYPES.Decimal,valor:t.valorUsd,opciones:{precision:14,scale:2}});
        parametros.push({nombre:`d${i}`,tipo:TYPES.NVarChar,valor:JSON.stringify(detalle)});
        return `(CONVERT(date,@hoy,112),@codven,@codusu,@p${i},@t${i},@c${i},@n${i},@v${i},@d${i},GETDATE())`;
    }).join(',');
    await ejecutar(conexion,
        `INSERT INTO dbo.tbl_api_quienvender(fecha,codven,codusu,puesto,tipo,codcli,cliente,valor,detalle,creado) VALUES ${filas}`,
        parametros);
}

/////Las sugerencias del dia de un vendedor. `hoy` (AAAAMMDD) solo lo pasan las pruebas, para simular un
/////dia pasado; la ruta nunca lo pasa y se usa la fecha del servidor.
async function armarDia(conexion, yo, hoyElegido){
    const hoy = hoyElegido || await hoyDelServidor(conexion);

    /////1) cerrar los dias anteriores. Si falla (tabla ausente), se sigue
    try{ await cerrarDias(conexion, yo, hoy); }
    catch(err){ console.error('[quienvender] no se pudieron cerrar los dias anteriores:', err && err.message ? err.message : err); }

    /////2) las de hoy, si ya se le dieron
    let sugeridos = null, historia = new Map();
    try{
        sugeridos = await leerDia(conexion, yo, hoy);
        if(sugeridos.length === 0) historia = await ultimasSugerencias(conexion, yo, hoy);
    }
    catch(err){
        console.error('[quienvender] no se pudo leer tbl_api_quienvender:', err && err.message ? err.message : err);
        sugeridos = [];
    }

    /////3) si no, se calculan y se graban
    if(sugeridos.length === 0){
        const {ctx, elegidos} = await elegir(conexion, yo, hoy, historia);
        sugeridos = [];
        for(const e of elegidos){
            const d = await detallar(conexion, ctx, e);
            sugeridos.push(tarjeta(e.puesto, e.tipo, e.c.codcli, e.c.cliente, d));
        }
        if(sugeridos.length){
            try{ await grabarDia(conexion, yo, hoy, sugeridos); }
            catch(err){
                /////2627: otra peticion del mismo vendedor grabo primero; esas son las del dia
                if(err && err.number === 2627){
                    try{ const ya = await leerDia(conexion, yo, hoy); if(ya.length) sugeridos = ya; }catch(e2){}
                }
                else console.error('[quienvender] no se pudo grabar el dia:', err && err.message ? err.message : err);
            }
        }
    }

    return {
        fecha: conFormato(hoy),
        vendedor: {codven: yo.codven, tipo: yo.tipo},
        sugeridos: sugeridos,
        aviso: sugeridos.length ? null : 'todavia no hay clientes para sugerirte'
    };
}

/////GET /quienvender
let quienvender_hoy = async (resolve,reject,conexion,galleta)=>{
    try{
        const q = await quienPregunta(conexion, galleta);
        if(q.rechazo){ conexion.close(); return reject(q.rechazo); }
        const resultado = await armarDia(conexion, q.yo);
        conexion.close();
        resolve(resultado);
    }
    catch(err){
        console.error('[quienvender]', err && err.message ? err.message : err);
        conexion.close();
        reject("error query");
    }
}

module.exports={quienvender_hoy, armarDia, quienPregunta}
