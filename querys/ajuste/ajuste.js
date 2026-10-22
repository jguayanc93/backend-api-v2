const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, soloLectura, enTransaccion, perfil} = require('../marcas/comun')
const {normalizarNdocu, SKU_DESCUENTO, MARCA_BONIFICACION, IGV} = require('../../funciones/comunes/constantes')

/////Ajuste de precio de cotizaciones y pedidos.
/////
/////  1. El vendedor (grupo 20) envia una cotizacion o pedido suyo a ajuste, con un mensaje.
/////     Se crea una solicitud por cada responsable: el dueño de la marca en el mes o, si la marca
/////     no tiene dueño, la jefatura de su familia. Las lineas de marcas sin responsable no se
/////     envian. Mientras haya una solicitud pendiente, el vendedor no puede modificar el documento.
/////  2. El responsable (grupo 25) la ve en recibidas, la abre y la confirma o la rechaza, con una
/////     observacion. Solo toca las lineas de su marca que le llegaron.
/////  3. Al confirmar, en esas lineas: precio nuevo, descuento del cliente en 0, cantidad nueva
/////     (solo cotizaciones) y el costo actual. Se quitan TODAS las promociones del documento. El
/////     precio del producto en el ERP no se toca nunca: el cambio es solo de esa venta.
/////  4. El precio nunca puede quedar por debajo del costo actual del producto.
/////  5. Si el documento ya avanzo (cotizacion aprobada, pedido facturado o anulado), lo pendiente
/////     ya no se puede confirmar: la solicitud queda CERRADA. Las facturas nunca se ajustan.
/////  6. A los 3 dias sin respuesta la solicitud VENCE y el documento se libera.

const DIAS_VIGENCIA = 3;
const LARGO_TEXTO = 300;

/////Lo que distingue a cada tipo de documento. "abierto" es cuando todavia se puede ajustar.
const TIPOS = {
    COT: {cdocu:'31', mst:'mst01cot', dtl:'dtl01cot', abierto:"m.flag='0' and m.estado='0'", cantidad:true,  nombre:'COTIZACION'},
    PED: {cdocu:'32', mst:'mst01ped', dtl:'dtl01ped', abierto:"m.flag='0' and m.apro='0'",  cantidad:false, nombre:'PEDIDO'}
};

/////una linea de promocion: el descuento (tambien el de flete) o un regalo
const ES_PROMOCION = "(d.codi=@sku or left(d.descr,11)=@bon)";
const PARAMS_PROMO = [{nombre:'sku',tipo:TYPES.VarChar,valor:SKU_DESCUENTO},
                      {nombre:'bon',tipo:TYPES.VarChar,valor:MARCA_BONIFICACION}];

/////El precio se maneja en centimos. El minimo es el costo redondeado HACIA ARRIBA al centimo:
/////con un costo de 7.4533 el minimo es 7.46, asi un precio "redondo" nunca queda bajo el costo.
function minimoDe(costo){ return costo == null ? null : Math.ceil(Math.round(costo * 10000) / 100) / 100; }

/////Redondeo al medio hacia arriba (8.205 -> 8.21, 8.204 -> 8.20). Se corre la coma con notacion
/////exponencial: Math.round(8.205*100) da 820 porque 8.205 se guarda como 8.20499999...
function redondear(n, d){
    if(n == null || !isFinite(n)) return null;
    const dec = d == null ? 2 : d;
    if(String(n).includes('e')){ const f = Math.pow(10, dec); return Math.round(n*f)/f; }
    return Number(Math.round(Number(n + 'e' + dec)) + 'e-' + dec);
}
function recortar(v){ const t = texto(v); return t ? t.slice(0, LARGO_TEXTO) : null; }
function numero(v){ return v == null ? null : Number(v); }

/////Las vencidas se marcan al vuelo, cada vez que alguien mira o actua
async function vencer(conexion){
    await ejecutar(conexion,
        "update tbl01_api_ajuste_solicitud set estado='VENCIDA' where estado='PENDIENTE' and vence<getdate()", []);
}

/////Las pendientes cuyo documento ya avanzo pasan a CERRADA. campo: quien mira (envia o recibe).
async function cerrarAvanzadas(conexion, campo, codusu){
    await ejecutar(conexion,
        `update s set estado='CERRADA', fecrespuesta=getdate()
         from tbl01_api_ajuste_solicitud s
         where s.estado='PENDIENTE' and s.${campo}=@codusu
           and ((s.tipo='COT' and not exists(select 1 from mst01cot m where m.cdocu=s.cdocu and m.ndocu=s.ndocu and ${TIPOS.COT.abierto}))
             or (s.tipo='PED' and not exists(select 1 from mst01ped m where m.cdocu=s.cdocu and m.ndocu=s.ndocu and ${TIPOS.PED.abierto})))`,
        [{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu}]);
}

/////¿Tiene el documento un ajuste pendiente? Lo usan las rutas del vendedor que modifican
/////cotizaciones y pedidos: mientras haya uno, no se toca.
async function enAjuste(conexion, ndocu){
    const r = await ejecutar(conexion,
        "select count(*) from tbl01_api_ajuste_solicitud where ndocu=@doc and estado='PENDIENTE' and vence>=getdate()",
        [{nombre:'doc',tipo:TYPES.VarChar,valor:ndocu}]);
    return r.rows[0][0].value > 0;
}

/////Cabecera del documento. Con bloquear, la deja tomada hasta el fin de la transaccion.
async function cabecera(conexion, tipo, ndocu, bloquear){
    const t = TIPOS[tipo];
    const r = await ejecutar(conexion,
        `select rtrim(m.codven_usu), rtrim(m.codcli), rtrim(m.nomcli), rtrim(m.mone), m.tcam, m.tota, m.totn,
                case when ${t.abierto} then 1 else 0 end, convert(char(10), m.fecha, 23)
         from ${t.mst} m ${bloquear ? 'with (updlock, holdlock)' : ''}
         where m.cdocu=@cdocu and m.ndocu=@ndocu`,
        [{nombre:'cdocu',tipo:TYPES.Char,valor:t.cdocu},{nombre:'ndocu',tipo:TYPES.VarChar,valor:ndocu}]);
    if(r.rows.length === 0) return null;
    const v = r.rows[0].map(c=>c.value);
    return {codven:texto(v[0]), codcli:v[1], cliente:v[2], moneda:v[3], tcam:Number(v[4]),
            total:numero(v[5]), totalConIgv:numero(v[6]), abierto:v[7] === 1, fecha:v[8]};
}

/////Lineas del documento con su marca. Sin las de promocion.
async function lineas(conexion, tipo, ndocu){
    const t = TIPOS[tipo];
    const r = await ejecutar(conexion,
        `select d.item, rtrim(d.codi), rtrim(d.codf), rtrim(d.descr), d.cant, d.preu, d.dsct, d.tota, rtrim(d.aigv),
                rtrim(d.codalm), p.codmar, rtrim(mr.abrmar), rtrim(mr.Nommar)
         from ${t.dtl} d
         left join prd0101 p on p.codi=d.codi
         left join tbl01mar mr on mr.codmar=p.codmar
         where d.cdocu=@cdocu and d.ndocu=@ndocu and not ${ES_PROMOCION} and d.codi<>'0000-000000'
         order by d.item`,
        [{nombre:'cdocu',tipo:TYPES.Char,valor:t.cdocu},{nombre:'ndocu',tipo:TYPES.VarChar,valor:ndocu}].concat(PARAMS_PROMO));
    return r.rows.map(f=>{
        const v = f.map(c=>c.value);
        return {item:v[0], codi:texto(v[1]), codf:texto(v[2]), descripcion:texto(v[3]), cantidad:numero(v[4]),
                precio:numero(v[5]), dsct:numero(v[6]), total:numero(v[7]), aigv:texto(v[8]), codalm:texto(v[9]),
                codmar:texto(v[10]), marca:{codmar:texto(v[10]), abrmar:texto(v[11]), nombre:texto(v[12])}};
    });
}

async function contarPromociones(conexion, tipo, ndocu){
    const t = TIPOS[tipo];
    const r = await ejecutar(conexion,
        `select count(*) from ${t.dtl} d where d.cdocu=@cdocu and d.ndocu=@ndocu and ${ES_PROMOCION}`,
        [{nombre:'cdocu',tipo:TYPES.Char,valor:t.cdocu},{nombre:'ndocu',tipo:TYPES.VarChar,valor:ndocu}].concat(PARAMS_PROMO));
    return r.rows[0][0].value;
}

/////Costo actual y stock disponible de cada producto en el almacen de su linea, con el costo en
/////la moneda del documento. {codalm|codi: {costo, stock}}
async function costosYStock(conexion, lineasDoc, moneda, tcam){
    const resultado = {};
    const porAlmacen = {};
    lineasDoc.forEach(l=>{
        const alm = /^(0[1-9]|1[0-6])$/.test(l.codalm || '') ? l.codalm : '01';
        (porAlmacen[alm] = porAlmacen[alm] || new Set()).add(l.codi);
    });
    for(const alm of Object.keys(porAlmacen)){
        const codigos = [...porAlmacen[alm]];
        const parametros = [];
        const lista = codigos.map((c,i)=>{ parametros.push({nombre:`c${i}`,tipo:TYPES.VarChar,valor:c}); return `@c${i}`; }).join(',');
        const r = await ejecutar(conexion,
            `select rtrim(codi), pcus,
                    cast(isnull(stoc,0) as int) - (cast(isnull(svta,0) as int) + cast(isnull(pedi,0) as int))
             from prd01${alm} where codi in (${lista})`, parametros);
        r.rows.forEach(f=>{
            const usd = Number(f[1].value || 0);
            resultado[`${alm}|${texto(f[0].value)}`] = {costo: redondear(moneda === 'S' ? usd * tcam : usd, 4), stock: f[2].value};
        });
    }
    return {
        de: (l)=>{
            const alm = /^(0[1-9]|1[0-6])$/.test(l.codalm || '') ? l.codalm : '01';
            return resultado[`${alm}|${l.codi}`] || {costo:null, stock:null};
        }
    };
}

/////Quien es responsable de cada marca este mes: el dueño, o la jefatura de su familia
async function responsables(conexion, codigos){
    if(codigos.length === 0) return {};
    const parametros = [];
    const valores = codigos.map((c,i)=>{ parametros.push({nombre:`m${i}`,tipo:TYPES.Char,valor:c}); return `(@m${i})`; }).join(',');
    const r = await ejecutar(conexion,
        `select x.codmar, rtrim(coalesce(a.codusu, j.codusu)), rtrim(u.nomusu),
                case when a.codusu is not null then 'DUENO' when j.codusu is not null then 'JEFATURA' end
         from (values ${valores}) x(codmar)
         left join tbl01_api_marcas_asignadas a on a.anno=year(getdate()) and a.mes=month(getdate()) and a.codmar=x.codmar
         left join tbl01_api_marcas_estado e on e.codmar=x.codmar
         left join tbl01_api_jefatura_familia j on j.codfam=e.codfam
         left join fcu0000 u on u.codusu=coalesce(a.codusu, j.codusu)`, parametros);
    const resultado = {};
    r.rows.forEach(f=>{
        const codusu = texto(f[1].value);
        if(codusu) resultado[texto(f[0].value)] = {codusu:codusu, nombre:texto(f[2].value), por:texto(f[3].value)};
    });
    return resultado;
}

function leerTipo(v){ const t = String(v == null ? '' : v).trim().toUpperCase(); return TIPOS[t] ? t : null; }

/////Lo comun a la vista previa y al envio: valida el documento y reparte sus lineas entre los
/////responsables. Devuelve {rechazo} o {doc, grupos, sinResponsable, promociones}.
async function repartir(conexion, galleta, cuerpo, bloquear){
    const tipo = leerTipo(cuerpo.tipo);
    const ndocu = normalizarNdocu(cuerpo.ndocu);
    if(!tipo) return {rechazo:"tipo invalido"};
    if(!ndocu) return {rechazo:"documento ambiguo"};

    await vencer(conexion);
    const doc = await cabecera(conexion, tipo, ndocu, bloquear);
    if(!doc || doc.codven !== texto(galleta.codigo)) return {rechazo:"documento desconocido"};
    if(!doc.abierto) return {rechazo:"documento no ajustable"};
    if(await enAjuste(conexion, ndocu)) return {rechazo:"documento en ajuste"};

    const todas = await lineas(conexion, tipo, ndocu);
    const quienes = await responsables(conexion, [...new Set(todas.filter(l=>l.codmar).map(l=>l.codmar))]);

    const grupos = {}, sinResponsable = [];
    todas.forEach(l=>{
        const q = l.codmar ? quienes[l.codmar] : null;
        if(!q){ sinResponsable.push({item:l.item, codi:l.codi, codf:l.codf, descripcion:l.descripcion, marca:l.marca, cantidad:l.cantidad}); return; }
        (grupos[q.codusu] = grupos[q.codusu] || {recibe:{codusu:q.codusu, nombre:q.nombre, como:q.por}, lineas:[]}).lineas.push(l);
    });
    if(Object.keys(grupos).length === 0) return {rechazo:"sin responsables"};

    return {tipo, ndocu, doc, grupos:Object.values(grupos), sinResponsable,
            promociones: await contarPromociones(conexion, tipo, ndocu)};
}

function lineasParaVer(ls){
    return ls.map(l=>({item:l.item, codi:l.codi, codf:l.codf, descripcion:l.descripcion, marca:l.marca,
                       cantidad:l.cantidad, precio:l.precio}));
}

/////POST /ajuste/previa: el mismo cuerpo que enviar; dice a quien iria cada linea, sin crear nada
let ajuste_previa = (resolve,reject,conexion,galleta,cuerpo)=>{
    enTransaccion(resolve, reject, conexion, 'ajuste previa', async ()=>{
        const r = await repartir(conexion, galleta, cuerpo, false);
        if(r.rechazo) return r;
        return {tipo:r.tipo, ndocu:r.ndocu, cliente:r.doc.cliente, moneda:r.doc.moneda,
                solicitudes: r.grupos.map(g=>({recibe:g.recibe, lineas:lineasParaVer(g.lineas)})),
                sinResponsable:r.sinResponsable, promociones:r.promociones};
    });
}

/////POST /ajuste/enviar: {"tipo":"COT","ndocu":"009-00970435","mensaje":"mejora el precio"}
let ajuste_enviar = (resolve,reject,conexion,galleta,cuerpo)=>{
    const codusu = texto(galleta.identificador), codven = texto(galleta.codigo);

    enTransaccion(resolve, reject, conexion, 'ajuste enviar', async ()=>{
        const r = await repartir(conexion, galleta, cuerpo, true);
        if(r.rechazo) return r;
        const {tipo, ndocu, doc} = r;

        const solicitudes = [];
        for(const g of r.grupos){
            const ins = await ejecutar(conexion,
                `insert into tbl01_api_ajuste_solicitud(tipo,cdocu,ndocu,codusu_envia,codven_envia,codusu_recibe,mensaje,vence)
                 output inserted.id, convert(varchar(19), inserted.vence, 126)
                 values(@tipo,@cdocu,@ndocu,@envia,@codven,@recibe,@mensaje,dateadd(day,${DIAS_VIGENCIA},getdate()))`,
                [{nombre:'tipo',tipo:TYPES.Char,valor:tipo},{nombre:'cdocu',tipo:TYPES.Char,valor:TIPOS[tipo].cdocu},
                 {nombre:'ndocu',tipo:TYPES.VarChar,valor:ndocu},{nombre:'envia',tipo:TYPES.VarChar,valor:codusu},
                 {nombre:'codven',tipo:TYPES.VarChar,valor:codven},{nombre:'recibe',tipo:TYPES.VarChar,valor:g.recibe.codusu},
                 {nombre:'mensaje',tipo:TYPES.VarChar,valor:recortar(cuerpo.mensaje)}]);
            const id = ins.rows[0][0].value;
            for(const l of g.lineas){
                await ejecutar(conexion,
                    `insert into tbl01_api_ajuste_detalle(id_solicitud,item,codi,codmar,cant_antes,preu_antes,dsct_antes)
                     values(@id,@item,@codi,@codmar,@cant,@preu,@dsct)`,
                    [{nombre:'id',tipo:TYPES.Int,valor:id},{nombre:'item',tipo:TYPES.Int,valor:l.item},
                     {nombre:'codi',tipo:TYPES.VarChar,valor:l.codi},{nombre:'codmar',tipo:TYPES.Char,valor:l.codmar},
                     {nombre:'cant',tipo:TYPES.Decimal,valor:l.cantidad,opciones:{precision:12,scale:3}},
                     {nombre:'preu',tipo:TYPES.Decimal,valor:l.precio,opciones:{precision:14,scale:4}},
                     {nombre:'dsct',tipo:TYPES.Decimal,valor:l.dsct,opciones:{precision:6,scale:2}}]);
            }
            solicitudes.push({id:id, recibe:g.recibe, vence:ins.rows[0][1].value, lineas:lineasParaVer(g.lineas)});
        }

        return {tipo:tipo, ndocu:ndocu, cliente:doc.cliente, moneda:doc.moneda, solicitudes:solicitudes,
                sinResponsable:r.sinResponsable, promociones:r.promociones};
    });
}

/////El detalle guardado de varias solicitudes: {id: [lineas]}
async function detalles(conexion, ids){
    if(ids.length === 0) return {};
    const parametros = [];
    const lista = ids.map((id,i)=>{ parametros.push({nombre:`i${i}`,tipo:TYPES.Int,valor:id}); return `@i${i}`; }).join(',');
    const r = await ejecutar(conexion,
        `select d.id_solicitud, d.item, rtrim(d.codi), rtrim(p.codf), rtrim(p.descr), d.codmar, rtrim(mr.abrmar), rtrim(mr.Nommar),
                d.cant_antes, d.preu_antes, d.dsct_antes, d.cant_despues, d.preu_despues, d.costo
         from tbl01_api_ajuste_detalle d
         left join prd0101 p on p.codi=d.codi
         left join tbl01mar mr on mr.codmar=d.codmar
         where d.id_solicitud in (${lista}) order by d.id_solicitud, d.item`, parametros);
    const resultado = {};
    r.rows.forEach(f=>{
        const v = f.map(c=>c.value);
        (resultado[v[0]] = resultado[v[0]] || []).push({
            item:v[1], codi:texto(v[2]), codf:texto(v[3]), descripcion:texto(v[4]),
            marca:{codmar:texto(v[5]), abrmar:texto(v[6]), nombre:texto(v[7])},
            antes:{cantidad:numero(v[8]), precio:numero(v[9]), dsct:numero(v[10])},
            despues: v[12] == null ? null : {cantidad:numero(v[11]), precio:numero(v[12]), dsct:0, costo:numero(v[13])}
        });
    });
    return resultado;
}

/////"AAAA-MM-DD" -> "AAAAMMDD" (el formato que SQL Server lee igual en cualquier idioma), o null
function leerDia(v){
    const t = texto(v);
    if(!t || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(t)) return null;
    const [a,m,d] = t.split('-').map(Number);
    const fecha = new Date(Date.UTC(a, m-1, d));
    if(fecha.getUTCFullYear() !== a || fecha.getUTCMonth() !== m-1 || fecha.getUTCDate() !== d) return null;
    return t.replace(/-/g,'');
}
/////filtros desde/hasta. Sin ellos: {}. Mal escritos, inexistentes o desde despues de hasta: {error}.
function leerFechas(filtros){
    const vino = (v)=>v != null && String(v).trim() !== '';
    const desde = vino(filtros.desde) ? leerDia(filtros.desde) : undefined;
    const hasta = vino(filtros.hasta) ? leerDia(filtros.hasta) : undefined;
    if(desde === null || hasta === null) return {error:true};
    if(desde && hasta && desde > hasta) return {error:true};
    return {desde, hasta};
}

/////Lista de solicitudes de quien envia o de quien recibe. Las mas recientes primero.
async function listar(conexion, campo, codusu, filtros){
    const parametros = [{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu}];
    let extra = '';
    const estado = texto(filtros.estado);
    if(estado){ extra += ' and s.estado=@estado'; parametros.push({nombre:'estado',tipo:TYPES.VarChar,valor:estado.toUpperCase()}); }
    const ndocu = filtros.ndocu ? normalizarNdocu(filtros.ndocu) : null;
    if(ndocu){ extra += ' and s.ndocu=@ndocu'; parametros.push({nombre:'ndocu',tipo:TYPES.VarChar,valor:ndocu}); }
    /////por fecha de envio, AAAA-MM-DD (dias completos, hora de Lima)
    const {desde, hasta} = leerFechas(filtros);
    if(desde){ extra += ' and s.fecreg>=@desde'; parametros.push({nombre:'desde',tipo:TYPES.VarChar,valor:desde}); }
    if(hasta){ extra += ' and s.fecreg<dateadd(day,1,@hasta)'; parametros.push({nombre:'hasta',tipo:TYPES.VarChar,valor:hasta}); }

    const r = await ejecutar(conexion,
        `select top 100 s.id, s.tipo, rtrim(s.ndocu), s.estado, s.mensaje, s.observacion,
                convert(varchar(19), s.fecreg, 126), convert(varchar(19), s.vence, 126), convert(varchar(19), s.fecrespuesta, 126),
                rtrim(s.codusu_envia), rtrim(ue.nomusu), rtrim(s.codusu_recibe), rtrim(ur.nomusu),
                rtrim(coalesce(c.nomcli, p.nomcli)), rtrim(coalesce(c.mone, p.mone))
         from tbl01_api_ajuste_solicitud s
         left join fcu0000 ue on ue.codusu=s.codusu_envia
         left join fcu0000 ur on ur.codusu=s.codusu_recibe
         left join mst01cot c on s.tipo='COT' and c.cdocu=s.cdocu and c.ndocu=s.ndocu
         left join mst01ped p on s.tipo='PED' and p.cdocu=s.cdocu and p.ndocu=s.ndocu
         where s.${campo}=@codusu ${extra}
         order by s.fecreg desc, s.id desc`, parametros);
    const filas = r.rows.map(f=>f.map(c=>c.value));
    const det = await detalles(conexion, filas.map(v=>v[0]));
    return filas.map(v=>{
        const ls = det[v[0]] || [];
        return {
            id:v[0], tipo:texto(v[1]), ndocu:v[2], estado:texto(v[3]), cliente:v[13], moneda:v[14],
            mensaje:v[4], observacion:v[5], fecreg:v[6], vence:v[7], fecrespuesta:v[8],
            envia:{codusu:v[9], nombre:v[10]}, recibe:{codusu:v[11], nombre:v[12]},
            lineas:ls,
            montoEnviado: redondear(ls.reduce((t,l)=>t + l.antes.cantidad * l.antes.precio * (1 - l.antes.dsct/100), 0))
        };
    });
}

/////GET /ajuste/enviadas (grupo 20)
let ajuste_enviadas = (resolve,reject,conexion,galleta,cuerpo)=>{
    if(leerFechas(cuerpo).error){ conexion.close(); return reject("fechas invalidas"); }
    enTransaccion(resolve, reject, conexion, 'ajuste enviadas', async ()=>{
        const codusu = texto(galleta.identificador);
        await vencer(conexion);
        await cerrarAvanzadas(conexion, 'codusu_envia', codusu);
        return {solicitudes: await listar(conexion, 'codusu_envia', codusu, cuerpo)};
    });
}

/////GET /ajuste/recibidas (grupo 25)
let ajuste_recibidas = (resolve,reject,conexion,galleta,cuerpo)=>{
    if(leerFechas(cuerpo).error){ conexion.close(); return reject("fechas invalidas"); }
    enTransaccion(resolve, reject, conexion, 'ajuste recibidas', async ()=>{
        const codusu = texto(galleta.identificador);
        const yo = await perfil(conexion, codusu, false);
        if(!yo.tipo && !yo.familia) return {rechazo:"no identificado"};
        await vencer(conexion);
        await cerrarAvanzadas(conexion, 'codusu_recibe', codusu);
        const lista = await listar(conexion, 'codusu_recibe', codusu, cuerpo);
        /////en la lista no hace falta el detalle completo: cuantas lineas y el monto
        return {solicitudes: lista.map(s=>Object.assign({}, s, {lineas: s.lineas.length}))};
    });
}

/////Una solicitud de quien la recibe, con todo lo necesario para ajustarla
async function solicitudDe(conexion, id, codusu, bloquear){
    const r = await ejecutar(conexion,
        `select s.tipo, rtrim(s.ndocu), s.estado, s.mensaje, s.observacion,
                convert(varchar(19), s.fecreg, 126), convert(varchar(19), s.vence, 126),
                rtrim(s.codusu_envia), rtrim(ue.nomusu)
         from tbl01_api_ajuste_solicitud s ${bloquear ? 'with (updlock, holdlock)' : ''}
         left join fcu0000 ue on ue.codusu=s.codusu_envia
         where s.id=@id and s.codusu_recibe=@codusu`,
        [{nombre:'id',tipo:TYPES.Int,valor:id},{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu}]);
    if(r.rows.length === 0) return null;
    const v = r.rows[0].map(c=>c.value);
    return {id:id, tipo:texto(v[0]), ndocu:v[1], estado:texto(v[2]), mensaje:v[3], observacion:v[4],
            fecreg:v[5], vence:v[6], envia:{codusu:v[7], nombre:v[8]}};
}

function leerId(v){ const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; }

/////GET /ajuste/solicitud?id=12 (grupo 25): para la pantalla de ajustar
let ajuste_solicitud = (resolve,reject,conexion,galleta,cuerpo)=>{
    const id = leerId(cuerpo.id);
    if(!id){ conexion.close(); return reject("solicitud desconocida"); }

    enTransaccion(resolve, reject, conexion, 'ajuste solicitud', async ()=>{
        const codusu = texto(galleta.identificador);
        await vencer(conexion);
        await cerrarAvanzadas(conexion, 'codusu_recibe', codusu);
        const sol = await solicitudDe(conexion, id, codusu, false);
        if(!sol) return {rechazo:"solicitud desconocida"};

        const doc = await cabecera(conexion, sol.tipo, sol.ndocu, false);
        const det = (await detalles(conexion, [id]))[id] || [];
        const actuales = doc ? await lineas(conexion, sol.tipo, sol.ndocu) : [];
        const precios = doc ? await costosYStock(conexion, actuales, doc.moneda, doc.tcam) : {de:()=>({})};
        const porItem = {};
        actuales.forEach(l=>porItem[l.item] = l);

        const mias = det.map(d=>{
            const l = porItem[d.item];
            const cs = l ? precios.de(l) : {costo:null, stock:null};
            const precio = l ? l.precio : null;
            const margen = (precio != null && cs.costo != null) ? precio - cs.costo : null;
            return {
                item:d.item, codi:d.codi, codf:d.codf, descripcion:d.descripcion, marca:d.marca,
                enviado: d.antes,
                /////como esta la linea ahora en el documento
                actual: l ? {cantidad:l.cantidad, precio:l.precio, dsct:l.dsct, total:l.total,
                             /////lo que paga hoy el cliente por unidad: precio con su descuento
                             precioNeto: redondear(l.precio * (1 - (l.dsct || 0) / 100), 4)} : null,
                costo: cs.costo, stock: cs.stock, almacen: l ? l.codalm : null,
                /////el precio no puede bajar de aqui
                precioMinimo: minimoDe(cs.costo),
                /////con el precio actual y sin descuento, que es como queda al ajustar
                margen: margen == null ? null : {
                    monto: redondear(margen),
                    sobreCosto: cs.costo ? redondear(margen / cs.costo * 100) : null,
                    sobreVenta: precio ? redondear(margen / precio * 100) : null
                },
                ajuste: d.despues
            };
        });

        return Object.assign({}, sol, {
            puedoAjustar: sol.estado === 'PENDIENTE' && !!doc && doc.abierto,
            cantidadAjustable: TIPOS[sol.tipo].cantidad,
            documento: doc ? {tipo:TIPOS[sol.tipo].nombre, ndocu:sol.ndocu, fecha:doc.fecha, cliente:doc.cliente,
                              moneda:doc.moneda, tcam:doc.tcam, total:doc.total, totalConIgv:doc.totalConIgv,
                              abierto:doc.abierto} : null,
            promociones: doc ? await contarPromociones(conexion, sol.tipo, sol.ndocu) : 0,
            otrasLineas: Math.max(0, actuales.length - mias.length),
            lineas: mias
        });
    });
}

/////POST /ajuste/confirmar: {"id":12,"lineas":[{"item":1,"precio":105.5,"cantidad":2}],"observacion":"..."}
let ajuste_confirmar = (resolve,reject,conexion,galleta,cuerpo)=>{
    const id = leerId(cuerpo.id);
    if(!id){ conexion.close(); return reject("solicitud desconocida"); }
    const pedidas = Array.isArray(cuerpo.lineas) ? cuerpo.lineas : [];
    if(pedidas.length === 0){ conexion.close(); return reject("ajuste vacio"); }

    enTransaccion(resolve, reject, conexion, 'ajuste confirmar', async ()=>{
        const codusu = texto(galleta.identificador);
        await vencer(conexion);
        const sol = await solicitudDe(conexion, id, codusu, true);
        if(!sol) return {rechazo:"solicitud desconocida"};
        if(sol.estado !== 'PENDIENTE') return {rechazo:"solicitud cerrada"};

        const t = TIPOS[sol.tipo];
        const doc = await cabecera(conexion, sol.tipo, sol.ndocu, true);
        if(!doc || !doc.abierto){
            await ejecutar(conexion, "update tbl01_api_ajuste_solicitud set estado='CERRADA', fecrespuesta=getdate() where id=@id",
                [{nombre:'id',tipo:TYPES.Int,valor:id}]);
            return {rechazoGuardando:"documento no ajustable"};
        }

        const det = (await detalles(conexion, [id]))[id] || [];
        const mias = new Set(det.map(d=>d.item));
        const actuales = await lineas(conexion, sol.tipo, sol.ndocu);
        const porItem = {};
        actuales.forEach(l=>porItem[l.item] = l);
        const precios = await costosYStock(conexion, actuales, doc.moneda, doc.tcam);

        /////1) validar todo antes de tocar nada
        const cambios = [];
        const vistos = new Set();
        for(const p of pedidas){
            const item = Number(p && p.item);
            if(!mias.has(item) || vistos.has(item) || !porItem[item]) return {rechazo:"linea ajena"};
            vistos.add(item);
            const l = porItem[item];
            const precio = Number(p.precio);
            if(!isFinite(precio) || precio <= 0) return {rechazo:"precio invalido"};
            let cantidad = l.cantidad;
            if(p.cantidad != null && p.cantidad !== ''){
                const c = Number(p.cantidad);
                if(!Number.isInteger(c) || c < 1) return {rechazo:"cantidad invalida"};
                if(c !== Number(l.cantidad) && !t.cantidad) return {rechazo:"cantidad no ajustable"};
                cantidad = c;
            }
            const costo = precios.de(l).costo;
            if(costo == null) return {rechazo:"costo desconocido"};
            const enCentimos = redondear(precio, 2);
            if(enCentimos < minimoDe(costo)) return {rechazo:"precio bajo costo"};
            cambios.push({linea:l, precio:enCentimos, cantidad:cantidad, costo:costo});
        }

        /////2) las lineas: precio nuevo, descuento en 0, cantidad nueva, costo actual
        for(const c of cambios){
            const tota = redondear(c.cantidad * c.precio);
            const totn = c.linea.aigv === 'N' ? tota : redondear(tota * (1 + IGV));
            await ejecutar(conexion,
                `update ${t.dtl} set preu=@preu, dsct=0, cant=@cant, tota=@tota, totn=@totn, cost=@cost
                 where cdocu=@cdocu and ndocu=@ndocu and item=@item`,
                [{nombre:'preu',tipo:TYPES.Float,valor:c.precio},{nombre:'cant',tipo:TYPES.Float,valor:c.cantidad},
                 {nombre:'tota',tipo:TYPES.Float,valor:tota},{nombre:'totn',tipo:TYPES.Float,valor:totn},
                 {nombre:'cost',tipo:TYPES.Float,valor:c.costo},{nombre:'cdocu',tipo:TYPES.Char,valor:t.cdocu},
                 {nombre:'ndocu',tipo:TYPES.VarChar,valor:sol.ndocu},{nombre:'item',tipo:TYPES.Int,valor:c.linea.item}]);
            await ejecutar(conexion,
                `update tbl01_api_ajuste_detalle set cant_despues=@cant, preu_despues=@preu, costo=@cost
                 where id_solicitud=@id and item=@item`,
                [{nombre:'cant',tipo:TYPES.Decimal,valor:c.cantidad,opciones:{precision:12,scale:3}},
                 {nombre:'preu',tipo:TYPES.Decimal,valor:c.precio,opciones:{precision:14,scale:4}},
                 {nombre:'cost',tipo:TYPES.Decimal,valor:c.costo,opciones:{precision:14,scale:4}},
                 {nombre:'id',tipo:TYPES.Int,valor:id},{nombre:'item',tipo:TYPES.Int,valor:c.linea.item}]);
        }

        /////3) fuera todas las promociones del documento, tambien su registro en el ERP
        const docParams = [{nombre:'cdocu',tipo:TYPES.Char,valor:t.cdocu},{nombre:'ndocu',tipo:TYPES.VarChar,valor:sol.ndocu}];
        const promos = await contarPromociones(conexion, sol.tipo, sol.ndocu);
        if(promos > 0){
            await ejecutar(conexion, `delete d from ${t.dtl} d where d.cdocu=@cdocu and d.ndocu=@ndocu and ${ES_PROMOCION}`,
                docParams.concat(PARAMS_PROMO));
        }
        await ejecutar(conexion, "delete from dtl_promocion_venta where cdocu=@cdocu and ndocu=@ndocu", docParams);

        /////4) la cabecera sale del detalle: IGV solo de las lineas afectas
        const suma = await ejecutar(conexion,
            `select isnull(sum(tota),0), isnull(sum(case when aigv='N' then 0 else tota end),0)
             from ${t.dtl} where cdocu=@cdocu and ndocu=@ndocu`, docParams);
        const tota = redondear(suma.rows[0][0].value);
        const toti = redondear(suma.rows[0][1].value * IGV);
        const totn = redondear(tota + toti);
        await ejecutar(conexion,
            `update ${t.mst} set tota=@tota, toti=@toti, totn=@totn where cdocu=@cdocu and ndocu=@ndocu`,
            [{nombre:'tota',tipo:TYPES.Float,valor:tota},{nombre:'toti',tipo:TYPES.Float,valor:toti},
             {nombre:'totn',tipo:TYPES.Float,valor:totn}].concat(docParams));

        /////5) la solicitud
        await ejecutar(conexion,
            "update tbl01_api_ajuste_solicitud set estado='CONFIRMADA', observacion=@obs, fecrespuesta=getdate() where id=@id",
            [{nombre:'obs',tipo:TYPES.VarChar,valor:recortar(cuerpo.observacion)},{nombre:'id',tipo:TYPES.Int,valor:id}]);

        return {id:id, estado:'CONFIRMADA', ndocu:sol.ndocu, tipo:sol.tipo,
                lineas: cambios.map(c=>({item:c.linea.item, codi:c.linea.codi,
                                         antes:{cantidad:c.linea.cantidad, precio:c.linea.precio, dsct:c.linea.dsct},
                                         despues:{cantidad:c.cantidad, precio:c.precio, dsct:0, costo:c.costo}})),
                promocionesQuitadas: promos,
                totales: {tota:tota, toti:toti, totn:totn}};
    });
}

/////POST /ajuste/rechazar: {"id":12,"observacion":"el cliente tiene que llevar 10 unidades"}
let ajuste_rechazar = (resolve,reject,conexion,galleta,cuerpo)=>{
    const id = leerId(cuerpo.id);
    const observacion = recortar(cuerpo.observacion);
    if(!id){ conexion.close(); return reject("solicitud desconocida"); }
    if(!observacion){ conexion.close(); return reject("observacion requerida"); }

    enTransaccion(resolve, reject, conexion, 'ajuste rechazar', async ()=>{
        const codusu = texto(galleta.identificador);
        await vencer(conexion);
        const sol = await solicitudDe(conexion, id, codusu, true);
        if(!sol) return {rechazo:"solicitud desconocida"};
        if(sol.estado !== 'PENDIENTE') return {rechazo:"solicitud cerrada"};
        await ejecutar(conexion,
            "update tbl01_api_ajuste_solicitud set estado='RECHAZADA', observacion=@obs, fecrespuesta=getdate() where id=@id",
            [{nombre:'obs',tipo:TYPES.VarChar,valor:observacion},{nombre:'id',tipo:TYPES.Int,valor:id}]);
        return {id:id, estado:'RECHAZADA', ndocu:sol.ndocu, tipo:sol.tipo, observacion:observacion};
    });
}

/////Cuantas solicitudes pendientes tiene alguien: las que le llegaron (grupo 25) o las que envio
/////(grupo 20). Para el numerito del menu. Cuenta SOLICITUDES (una por responsable), no documentos, y
/////solo las que se pueden responder: vigentes y con el documento abierto. Asi coincide con la pestaña
/////de pendientes, que cierra las de documentos que avanzaron. No escribe nada.
async function contarPendientes(conexion, codusu, grupo){
    const campo = String(grupo).trim() === '25' ? 'codusu_recibe' : 'codusu_envia';
    const r = await ejecutar(conexion,
        `select count(*) from tbl01_api_ajuste_solicitud s
         where s.${campo}=@codusu and s.estado='PENDIENTE' and s.vence>=getdate()
           and ((s.tipo='COT' and exists(select 1 from mst01cot m where m.cdocu=s.cdocu and m.ndocu=s.ndocu and ${TIPOS.COT.abierto}))
             or (s.tipo='PED' and exists(select 1 from mst01ped m where m.cdocu=s.cdocu and m.ndocu=s.ndocu and ${TIPOS.PED.abierto})))`,
        [{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu}]);
    return r.rows[0][0].value;
}

module.exports={contarPendientes, ajuste_previa, ajuste_enviar, ajuste_enviadas, ajuste_recibidas, ajuste_solicitud, ajuste_confirmar, ajuste_rechazar, enAjuste}
