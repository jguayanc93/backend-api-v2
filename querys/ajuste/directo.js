const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, soloLectura, enTransaccion, quienPregunta} = require('../marcas/comun')
const {normalizarNdocu, MARCA_FLETE} = require('../../funciones/comunes/constantes')
const {TIPOS, ES_PROMOCION, PARAMS_PROMO, minimoDe, redondear, recortar, numero, leerTipo, leerFechas,
       lineas, contarPromociones, costosYStock, responsables, escribirAjuste, enAjuste} = require('./ajuste')

/////Ajuste directo y asignacion (grupo 25). Contrato: docs/ajuste-directo.md
/////
/////  1. El jefe de marca (especialista o jefatura) ajusta el precio de SUS PROPIOS documentos: los
/////     que tienen su codven_usu. Cotizaciones sin aprobar o aprobadas, y pedidos sin aprobar o
/////     aprobados: el documento es suyo y la marca tambien, asi que puede mover el precio aunque
/////     ya este aprobado.
/////  2. Solo el precio, y solo en las lineas de sus marcas (las que tiene este mes o, si es
/////     jefatura, las de su familia sin dueño). La cantidad se cambia en el modulo de cotizacion.
/////  3. Las mismas reglas que confirmar una solicitud: nunca bajo el costo, descuento en 0, costo
/////     actual en la linea, y se quitan TODAS las promociones, incluido el flete de provincia.
/////  4. Puede asignar el documento a un vendedor del grupo 20, haya ajustado o no: cambia solo su
/////     codven_usu. Desde ahi es del vendedor, y al jefe de marca le queda el historial.

/////Cuando el jefe de marca todavia puede ajustar o asignar su documento. En cotizaciones, ademas,
/////que no se haya convertido en pedido o factura (cdge), aunque el ERP la deje en flag 0.
const PERMITIDO = {
    COT: "m.flag='0' and m.estado in ('0','3') and rtrim(isnull(m.cdge,''))=''",
    PED: "m.flag='0' and m.apro in ('0','1')"
};
/////En que quedo el documento, para mostrarlo
const SITUACION = {
    COT: `case when m.flag='*' then 'anulado'
               when rtrim(isnull(m.cdge,'')) in ('01','03') then 'facturado'
               when rtrim(isnull(m.cdge,''))='32' then 'pedido'
               when m.flag='1' then 'atendido'
               when m.estado='0' then 'sin aprobar'
               when m.estado='3' then 'aprobado'
               else 'otro' end`,
    PED: `case when m.flag='*' then 'anulado'
               when m.flag='1' then 'atendido'
               when m.apro='0' then 'sin aprobar'
               when m.apro='1' then 'aprobado'
               when m.apro='2' then 'desaprobado'
               else 'otro' end`
};
const DIAS_LISTA = 30;
const TOPE_LISTA = 100;
const TOPE_VENDEDORES = 50;
const GRUPO_VENDEDORES = '20';
/////la linea del descuento de flete de provincia: es una promocion mas, pero se nombra en el aviso
const ES_FLETE = "d.descr like @flete";
const PARAM_FLETE = {nombre:'flete',tipo:TYPES.VarChar,valor:MARCA_FLETE + '%'};

function leerCodven(v){ const t = String(v == null ? '' : v).trim().toUpperCase(); return /^[A-Z0-9]{1,10}$/.test(t) ? t : null; }

/////Las listas piden una fila de mas para saber si se cortaron: {filas, hayMas}
function cortar(filas, tope){ return {filas: filas.slice(0, tope), hayMas: filas.length > tope}; }

async function tieneFlete(conexion, tipo, ndocu){
    const t = TIPOS[tipo];
    const r = await ejecutar(conexion,
        `select count(*) from ${t.dtl} d where d.cdocu=@cdocu and d.ndocu=@ndocu and ${ES_FLETE}`,
        [{nombre:'cdocu',tipo:TYPES.Char,valor:t.cdocu},{nombre:'ndocu',tipo:TYPES.VarChar,valor:ndocu},PARAM_FLETE]);
    return r.rows[0][0].value > 0;
}

/////Cabecera de un documento para el ajuste directo. Con bloquear, la deja tomada hasta el fin de
/////la transaccion.
async function documento(conexion, tipo, ndocu, bloquear){
    const t = TIPOS[tipo];
    const r = await ejecutar(conexion,
        `select rtrim(m.codven_usu), rtrim(m.nomcli), rtrim(m.mone), m.tcam, m.tota, m.totn,
                case when ${PERMITIDO[tipo]} then 1 else 0 end, convert(char(10), m.fecha, 23), ${SITUACION[tipo]}
         from ${t.mst} m ${bloquear ? 'with (updlock, holdlock)' : ''}
         where m.cdocu=@cdocu and m.ndocu=@ndocu`,
        [{nombre:'cdocu',tipo:TYPES.Char,valor:t.cdocu},{nombre:'ndocu',tipo:TYPES.VarChar,valor:ndocu}]);
    if(r.rows.length === 0) return null;
    const v = r.rows[0].map(c=>c.value);
    return {codven:texto(v[0]), cliente:v[1], moneda:v[2], tcam:Number(v[3]), total:numero(v[4]),
            totalConIgv:numero(v[5]), permitido:v[6] === 1, fecha:v[7], situacion:texto(v[8])};
}

/////El tipo y el documento del cuerpo, y que el documento sea de quien pregunta.
/////Devuelve {rechazo} o {tipo, ndocu, doc}.
async function suyo(conexion, galleta, cuerpo, bloquear){
    const tipo = leerTipo(cuerpo.tipo);
    const ndocu = normalizarNdocu(cuerpo.ndocu);
    if(!tipo) return {rechazo:"tipo invalido"};
    if(!ndocu) return {rechazo:"documento ambiguo"};
    const doc = await documento(conexion, tipo, ndocu, bloquear);
    if(!doc || doc.codven !== texto(galleta.codigo)) return {rechazo:"documento desconocido"};
    return {tipo, ndocu, doc};
}

/////Las lineas del documento, separadas en las de sus marcas y las demas
async function repartirLineas(conexion, tipo, ndocu, codusu){
    const todas = await lineas(conexion, tipo, ndocu);
    const quienes = await responsables(conexion, [...new Set(todas.filter(l=>l.codmar).map(l=>l.codmar))]);
    const mias = todas.filter(l=>l.codmar && quienes[l.codmar] && quienes[l.codmar].codusu === codusu);
    return {todas, mias};
}

/////Los ajustes directos ya hechos sobre un documento, con sus lineas. Los mas recientes primero.
async function ajustesHechos(conexion, tipo, ndocu){
    const r = await ejecutar(conexion,
        `select x.id, convert(varchar(19), x.fecreg, 126), rtrim(x.codusu), rtrim(u.nomusu), x.observacion,
                x.promociones, x.totn_antes, x.totn_despues,
                d.item, rtrim(d.codi), rtrim(p.descr), d.codmar, rtrim(mr.abrmar), d.cant, d.preu_antes, d.dsct_antes,
                d.preu_despues, d.costo
         from tbl01_api_ajuste_directo x
         left join fcu0000 u on u.codusu=x.codusu
         join tbl01_api_ajuste_directo_detalle d on d.id_ajuste=x.id
         left join prd0101 p on p.codi=d.codi
         left join tbl01mar mr on mr.codmar=d.codmar
         where x.cdocu=@cdocu and x.ndocu=@ndocu
         order by x.fecreg desc, x.id desc, d.item`,
        [{nombre:'cdocu',tipo:TYPES.Char,valor:TIPOS[tipo].cdocu},{nombre:'ndocu',tipo:TYPES.VarChar,valor:ndocu}]);
    const porId = {}, orden = [];
    r.rows.forEach(f=>{
        const v = f.map(c=>c.value);
        if(!porId[v[0]]){
            porId[v[0]] = {id:v[0], fecreg:v[1], ajusta:{codusu:v[2], nombre:v[3]}, observacion:v[4],
                           promocionesQuitadas:v[5], totalConIgvAntes:numero(v[6]), totalConIgvDespues:numero(v[7]), lineas:[]};
            orden.push(v[0]);
        }
        porId[v[0]].lineas.push({item:v[8], codi:texto(v[9]), descripcion:texto(v[10]),
                                 marca:{codmar:texto(v[11]), abrmar:texto(v[12])},
                                 antes:{cantidad:numero(v[13]), precio:numero(v[14]), dsct:numero(v[15])},
                                 despues:{cantidad:numero(v[13]), precio:numero(v[16]), dsct:0, costo:numero(v[17])}});
    });
    return orden.map(id=>porId[id]);
}

/////GET /ajuste/directo/documentos?tipo=COT (grupo 25): sus documentos que todavia puede ajustar o
/////asignar. Por defecto los ultimos 30 dias; con desde/hasta, ese rango; con ndocu, solo ese
/////documento y las fechas no cuentan. Hasta 100, con hayMas si se corto.
let directo_documentos = (resolve,reject,conexion,galleta,cuerpo)=>{
    const tipo = leerTipo(cuerpo.tipo);
    if(!tipo){ conexion.close(); return reject("tipo invalido"); }
    const fechas = leerFechas(cuerpo);
    if(fechas.error){ conexion.close(); return reject("fechas invalidas"); }
    const vinoNdocu = cuerpo.ndocu != null && String(cuerpo.ndocu).trim() !== '';
    const ndocu = vinoNdocu ? normalizarNdocu(cuerpo.ndocu) : null;
    if(vinoNdocu && !ndocu){ conexion.close(); return reject("documento ambiguo"); }

    soloLectura(resolve, reject, conexion, 'ajuste directo documentos', async ()=>{
        const quien = await quienPregunta(conexion, galleta);
        if(quien.rechazo) return quien;
        const t = TIPOS[tipo];
        const parametros = [{nombre:'cdocu',tipo:TYPES.Char,valor:t.cdocu},
                            {nombre:'codven',tipo:TYPES.VarChar,valor:texto(galleta.codigo)},
                            {nombre:'codusu',tipo:TYPES.VarChar,valor:quien.yo.codusu}].concat(PARAMS_PROMO);
        parametros.push(PARAM_FLETE);
        let extra = '';
        /////con ndocu se busca ese documento y nada mas: las fechas no cuentan
        const porDefecto = !ndocu && !fechas.desde && !fechas.hasta;
        let desde = null, hasta = null;
        if(ndocu){ extra += ' and m.ndocu=@ndocu'; parametros.push({nombre:'ndocu',tipo:TYPES.VarChar,valor:ndocu}); }
        else{
            /////por fecha del documento, AAAA-MM-DD (dias completos). Sin fechas, los ultimos 30 dias,
            /////contados con la fecha del servidor y devueltos para que la pantalla los muestre
            if(porDefecto){
                const hoy = await ejecutar(conexion,
                    `select convert(char(10), dateadd(day,-${DIAS_LISTA},cast(getdate() as date)), 23), convert(char(10), getdate(), 23)`, []);
                desde = hoy.rows[0][0].value; hasta = hoy.rows[0][1].value;
            }
            else{ desde = cuerpo.desde ? String(cuerpo.desde).trim() : null; hasta = cuerpo.hasta ? String(cuerpo.hasta).trim() : null; }
            const d = porDefecto ? desde.replace(/-/g,'') : fechas.desde;
            const h = porDefecto ? null : fechas.hasta;
            if(d){ extra += ' and m.fecha>=@desde'; parametros.push({nombre:'desde',tipo:TYPES.VarChar,valor:d}); }
            if(h){ extra += ' and m.fecha<dateadd(day,1,@hasta)'; parametros.push({nombre:'hasta',tipo:TYPES.VarChar,valor:h}); }
        }

        const lineaVenta = `d.cdocu=m.cdocu and d.ndocu=m.ndocu and not ${ES_PROMOCION} and d.codi<>'0000-000000'`;
        const r = await ejecutar(conexion,
            `select top ${TOPE_LISTA + 1} rtrim(m.ndocu), convert(char(10), m.fecha, 23), rtrim(m.nomcli), rtrim(m.mone),
                    m.tota, m.totn, ${SITUACION[tipo]},
                    (select count(*) from ${t.dtl} d where ${lineaVenta}),
                    (select count(*) from ${t.dtl} d
                       join prd0101 p on p.codi=d.codi
                       left join tbl01_api_marcas_asignadas a on a.anno=year(getdate()) and a.mes=month(getdate()) and a.codmar=p.codmar
                       left join tbl01_api_marcas_estado e on e.codmar=p.codmar
                       left join tbl01_api_jefatura_familia j on j.codfam=e.codfam
                     where ${lineaVenta} and rtrim(coalesce(a.codusu, j.codusu))=@codusu),
                    (select count(*) from ${t.dtl} d where d.cdocu=m.cdocu and d.ndocu=m.ndocu and ${ES_PROMOCION}),
                    (select count(*) from tbl01_api_ajuste_directo x where x.cdocu=m.cdocu and x.ndocu=m.ndocu),
                    (select count(*) from ${t.dtl} d where d.cdocu=m.cdocu and d.ndocu=m.ndocu and ${ES_FLETE})
             from ${t.mst} m
             where m.cdocu=@cdocu and m.codven_usu=@codven and ${PERMITIDO[tipo]} ${extra}
             order by m.fecha desc, m.ndocu desc`, parametros);
        const {filas, hayMas} = cortar(r.rows, TOPE_LISTA);

        return {
            tipo: tipo,
            ndocu: ndocu,
            desde: desde,
            hasta: hasta,
            ultimosDias: porDefecto ? DIAS_LISTA : null,
            hayMas: hayMas,
            documentos: filas.map(f=>{
                const v = f.map(c=>c.value);
                return {ndocu:v[0], fecha:v[1], cliente:v[2], moneda:v[3], total:numero(v[4]), totalConIgv:numero(v[5]),
                        situacion:texto(v[6]), lineas:v[7], lineasMias:v[8], promociones:v[9], flete:v[11] > 0, ajustes:v[10]};
            })
        };
    });
}

/////GET /ajuste/directo/documento?tipo=COT&ndocu=009-00969476 (grupo 25): para la pantalla de ajustar
let directo_documento = (resolve,reject,conexion,galleta,cuerpo)=>{
    soloLectura(resolve, reject, conexion, 'ajuste directo documento', async ()=>{
        const quien = await quienPregunta(conexion, galleta);
        if(quien.rechazo) return quien;
        const s = await suyo(conexion, galleta, cuerpo, false);
        if(s.rechazo) return s;
        const {tipo, ndocu, doc} = s;

        const {todas, mias} = await repartirLineas(conexion, tipo, ndocu, quien.yo.codusu);
        const precios = await costosYStock(conexion, mias, doc.moneda, doc.tcam);
        const enSolicitud = await enAjuste(conexion, ndocu);
        const deMias = new Set(mias.map(l=>l.item));

        /////por que no se puede, en este orden: el documento ya avanzo, tiene una solicitud de ajuste
        /////pendiente, o (solo para ajustar) no tiene lineas de sus marcas
        const motivoAsignar = !doc.permitido ? 'documento avanzado' : enSolicitud ? 'documento en ajuste' : null;
        const motivoAjustar = motivoAsignar || (mias.length === 0 ? 'sin lineas propias' : null);

        return {
            tipo: tipo, ndocu: ndocu,
            /////mostrar los controles de ajustar y asignar solo si es true; si no, el motivo
            puedoAjustar: !motivoAjustar, motivoAjustar: motivoAjustar,
            puedoAsignar: !motivoAsignar, motivoAsignar: motivoAsignar,
            documento: {tipo:TIPOS[tipo].nombre, ndocu:ndocu, fecha:doc.fecha, cliente:doc.cliente,
                        moneda:doc.moneda, tcam:doc.tcam, total:doc.total, totalConIgv:doc.totalConIgv,
                        situacion:doc.situacion},
            promociones: await contarPromociones(conexion, tipo, ndocu),
            /////si entre las promociones esta el descuento de flete de provincia
            flete: await tieneFlete(conexion, tipo, ndocu),
            otrasLineas: todas.length - mias.length,
            /////las lineas de otras marcas, solo para verlas: sin costo ni margen
            otras: todas.filter(l=>!deMias.has(l.item)).map(l=>({
                item:l.item, codi:l.codi, codf:l.codf, descripcion:l.descripcion, marca:l.marca,
                cantidad:l.cantidad, precio:l.precio, dsct:l.dsct, total:l.total})),
            lineas: mias.map(l=>{
                const cs = precios.de(l);
                const margen = (l.precio != null && cs.costo != null) ? l.precio - cs.costo : null;
                return {
                    item:l.item, codi:l.codi, codf:l.codf, descripcion:l.descripcion, marca:l.marca,
                    actual: {cantidad:l.cantidad, precio:l.precio, dsct:l.dsct, total:l.total,
                             precioNeto: redondear(l.precio * (1 - (l.dsct || 0) / 100), 4)},
                    costo: cs.costo, stock: cs.stock, almacen: l.codalm,
                    precioMinimo: minimoDe(cs.costo),
                    /////con el precio de lista y sin descuento, que es como queda al ajustar
                    margen: margen == null ? null : {
                        monto: redondear(margen),
                        sobreCosto: cs.costo ? redondear(margen / cs.costo * 100) : null,
                        sobreVenta: l.precio ? redondear(margen / l.precio * 100) : null
                    }
                };
            }),
            ajustes: await ajustesHechos(conexion, tipo, ndocu)
        };
    });
}

/////POST /ajuste/directo/aplicar (grupo 25):
/////{"tipo":"COT","ndocu":"009-00969476","lineas":[{"item":1,"precio":8.2}],"observacion":"..."}
let directo_aplicar = (resolve,reject,conexion,galleta,cuerpo)=>{
    const pedidas = Array.isArray(cuerpo.lineas) ? cuerpo.lineas : [];
    if(pedidas.length === 0){ conexion.close(); return reject("ajuste vacio"); }

    enTransaccion(resolve, reject, conexion, 'ajuste directo aplicar', async ()=>{
        const quien = await quienPregunta(conexion, galleta);
        if(quien.rechazo) return quien;
        const codusu = quien.yo.codusu;
        const s = await suyo(conexion, galleta, cuerpo, true);
        if(s.rechazo) return s;
        const {tipo, ndocu, doc} = s;
        if(!doc.permitido) return {rechazo:"documento no ajustable"};
        if(await enAjuste(conexion, ndocu)) return {rechazo:"documento en ajuste"};

        const {mias} = await repartirLineas(conexion, tipo, ndocu, codusu);
        const porItem = {};
        mias.forEach(l=>porItem[l.item] = l);
        const precios = await costosYStock(conexion, mias, doc.moneda, doc.tcam);

        /////1) validar todo antes de tocar nada
        const cambios = [];
        const vistos = new Set();
        for(const p of pedidas){
            const item = Number(p && p.item);
            if(!porItem[item] || vistos.has(item)) return {rechazo:"linea ajena"};
            vistos.add(item);
            const l = porItem[item];
            const precio = Number(p.precio);
            if(!isFinite(precio) || precio <= 0) return {rechazo:"precio invalido"};
            /////solo precio: la cantidad se cambia en el modulo de cotizacion
            if(p.cantidad != null && p.cantidad !== '' && Number(p.cantidad) !== Number(l.cantidad)) return {rechazo:"cantidad no ajustable"};
            const costo = precios.de(l).costo;
            if(costo == null) return {rechazo:"costo desconocido"};
            const enCentimos = redondear(precio, 2);
            if(enCentimos < minimoDe(costo)) return {rechazo:"precio bajo costo"};
            cambios.push({linea:l, precio:enCentimos, cantidad:l.cantidad, costo:costo});
        }

        /////2) el documento: lineas, promociones y cabecera
        const escrito = await escribirAjuste(conexion, tipo, ndocu, cambios);

        /////3) el registro del ajuste
        const ins = await ejecutar(conexion,
            `insert into tbl01_api_ajuste_directo(tipo,cdocu,ndocu,codusu,observacion,promociones,totn_antes,totn_despues)
             output inserted.id
             values(@tipo,@cdocu,@ndocu,@codusu,@obs,@promos,@antes,@despues)`,
            [{nombre:'tipo',tipo:TYPES.Char,valor:tipo},{nombre:'cdocu',tipo:TYPES.Char,valor:TIPOS[tipo].cdocu},
             {nombre:'ndocu',tipo:TYPES.VarChar,valor:ndocu},{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu},
             {nombre:'obs',tipo:TYPES.VarChar,valor:recortar(cuerpo.observacion)},
             {nombre:'promos',tipo:TYPES.Int,valor:escrito.promociones},
             {nombre:'antes',tipo:TYPES.Decimal,valor:doc.totalConIgv || 0,opciones:{precision:14,scale:2}},
             {nombre:'despues',tipo:TYPES.Decimal,valor:escrito.totales.totn,opciones:{precision:14,scale:2}}]);
        const id = ins.rows[0][0].value;
        for(const c of cambios){
            await ejecutar(conexion,
                `insert into tbl01_api_ajuste_directo_detalle(id_ajuste,item,codi,codmar,cant,preu_antes,dsct_antes,preu_despues,costo)
                 values(@id,@item,@codi,@codmar,@cant,@antes,@dsct,@despues,@costo)`,
                [{nombre:'id',tipo:TYPES.Int,valor:id},{nombre:'item',tipo:TYPES.Int,valor:c.linea.item},
                 {nombre:'codi',tipo:TYPES.VarChar,valor:c.linea.codi},{nombre:'codmar',tipo:TYPES.Char,valor:c.linea.codmar},
                 {nombre:'cant',tipo:TYPES.Decimal,valor:c.cantidad,opciones:{precision:12,scale:3}},
                 {nombre:'antes',tipo:TYPES.Decimal,valor:c.linea.precio,opciones:{precision:14,scale:4}},
                 {nombre:'dsct',tipo:TYPES.Decimal,valor:c.linea.dsct || 0,opciones:{precision:6,scale:2}},
                 {nombre:'despues',tipo:TYPES.Decimal,valor:c.precio,opciones:{precision:14,scale:4}},
                 {nombre:'costo',tipo:TYPES.Decimal,valor:c.costo,opciones:{precision:14,scale:4}}]);
        }

        return {id:id, tipo:tipo, ndocu:ndocu,
                lineas: cambios.map(c=>({item:c.linea.item, codi:c.linea.codi,
                                         antes:{cantidad:c.linea.cantidad, precio:c.linea.precio, dsct:c.linea.dsct},
                                         despues:{cantidad:c.cantidad, precio:c.precio, dsct:0, costo:c.costo}})),
                promocionesQuitadas: escrito.promociones,
                totales: escrito.totales};
    });
}

/////GET /ajuste/directo/vendedores?pista=juan (grupo 25): a quien puede asignar. Los vendedores
/////activos del grupo 20, sin importar la cartera ni la zona del cliente; la pista busca en el nombre
/////o en el codigo. Hasta 50, con hayMas si se corto.
let directo_vendedores = (resolve,reject,conexion,galleta,cuerpo)=>{
    soloLectura(resolve, reject, conexion, 'ajuste directo vendedores', async ()=>{
        const quien = await quienPregunta(conexion, galleta);
        if(quien.rechazo) return quien;
        const pista = texto(cuerpo.pista);
        const parametros = [{nombre:'grupo',tipo:TYPES.VarChar,valor:GRUPO_VENDEDORES}];
        let extra = '';
        if(pista){
            extra = ' and (u.nomusu like @pista or u.codven like @pista)';
            parametros.push({nombre:'pista',tipo:TYPES.VarChar,valor:`%${pista.slice(0,40)}%`});
        }
        const r = await ejecutar(conexion,
            `select top ${TOPE_VENDEDORES + 1} rtrim(u.codven), rtrim(u.nomusu),
                    (select top 1 upper(rtrim(d.diferenciador)) from tbl_api_vendedores_diferenciador d where rtrim(d.codusu)=rtrim(u.codusu))
             from fcu0000 u
             where rtrim(u.codgru)=@grupo and u.estado=1 and rtrim(isnull(u.codven,''))<>'' ${extra}
             order by u.nomusu`, parametros);
        const {filas, hayMas} = cortar(r.rows, TOPE_VENDEDORES);
        return {hayMas: hayMas,
                vendedores: filas.map(f=>({codven:texto(f[0].value), nombre:texto(f[1].value), tipo:texto(f[2].value)}))};
    });
}

/////POST /ajuste/directo/asignar (grupo 25): {"tipo":"PED","ndocu":"009-00774171","codven":"V0278"}
let directo_asignar = (resolve,reject,conexion,galleta,cuerpo)=>{
    const codven = leerCodven(cuerpo.codven);
    if(!codven){ conexion.close(); return reject("vendedor invalido"); }

    enTransaccion(resolve, reject, conexion, 'ajuste directo asignar', async ()=>{
        const quien = await quienPregunta(conexion, galleta);
        if(quien.rechazo) return quien;
        const s = await suyo(conexion, galleta, cuerpo, true);
        if(s.rechazo) return s;
        const {tipo, ndocu, doc} = s;
        if(!doc.permitido) return {rechazo:"documento no asignable"};
        if(await enAjuste(conexion, ndocu)) return {rechazo:"documento en ajuste"};

        const v = await ejecutar(conexion,
            `select top 1 rtrim(u.codven), rtrim(u.nomusu) from fcu0000 u
             where rtrim(u.codven)=@codven and rtrim(u.codgru)=@grupo and u.estado=1`,
            [{nombre:'codven',tipo:TYPES.VarChar,valor:codven},{nombre:'grupo',tipo:TYPES.VarChar,valor:GRUPO_VENDEDORES}]);
        if(v.rows.length === 0) return {rechazo:"vendedor invalido"};
        const vendedor = {codven:texto(v.rows[0][0].value), nombre:texto(v.rows[0][1].value)};

        const t = TIPOS[tipo];
        const docParams = [{nombre:'cdocu',tipo:TYPES.Char,valor:t.cdocu},{nombre:'ndocu',tipo:TYPES.VarChar,valor:ndocu}];
        await ejecutar(conexion, `update ${t.mst} set codven_usu=@codven where cdocu=@cdocu and ndocu=@ndocu`,
            [{nombre:'codven',tipo:TYPES.VarChar,valor:vendedor.codven}].concat(docParams));
        const ins = await ejecutar(conexion,
            `insert into tbl01_api_documento_asignado(tipo,cdocu,ndocu,codusu_asigna,codven_antes,codven_nuevo,totn)
             output inserted.id, convert(varchar(19), inserted.fecreg, 126)
             values(@tipo,@cdocu,@ndocu,@codusu,@antes,@nuevo,@totn)`,
            [{nombre:'tipo',tipo:TYPES.Char,valor:tipo},{nombre:'codusu',tipo:TYPES.VarChar,valor:quien.yo.codusu},
             {nombre:'antes',tipo:TYPES.VarChar,valor:doc.codven},{nombre:'nuevo',tipo:TYPES.VarChar,valor:vendedor.codven},
             {nombre:'totn',tipo:TYPES.Decimal,valor:doc.totalConIgv || 0,opciones:{precision:14,scale:2}}].concat(docParams));

        return {id:ins.rows[0][0].value, fecreg:ins.rows[0][1].value, tipo:tipo, ndocu:ndocu,
                cliente:doc.cliente, moneda:doc.moneda, totalConIgv:doc.totalConIgv, vendedor:vendedor};
    });
}

/////GET /ajuste/asignados (grupo 25): lo que asigno, solo para consulta. Los mas recientes primero,
/////hasta 100 (hayMas si se corto), con desde/hasta por fecha de asignacion.
let ajuste_asignados = (resolve,reject,conexion,galleta,cuerpo)=>{
    const fechas = leerFechas(cuerpo);
    if(fechas.error){ conexion.close(); return reject("fechas invalidas"); }

    soloLectura(resolve, reject, conexion, 'ajuste asignados', async ()=>{
        const quien = await quienPregunta(conexion, galleta);
        if(quien.rechazo) return quien;
        const parametros = [{nombre:'codusu',tipo:TYPES.VarChar,valor:quien.yo.codusu}];
        let extra = '';
        if(fechas.desde){ extra += ' and s.fecreg>=@desde'; parametros.push({nombre:'desde',tipo:TYPES.VarChar,valor:fechas.desde}); }
        if(fechas.hasta){ extra += ' and s.fecreg<dateadd(day,1,@hasta)'; parametros.push({nombre:'hasta',tipo:TYPES.VarChar,valor:fechas.hasta}); }

        /////un codven lo pueden compartir usuarios de varios grupos: el nombre es el del grupo 20
        const r = await ejecutar(conexion,
            `select top ${TOPE_LISTA + 1} s.id, s.tipo, rtrim(s.ndocu), convert(varchar(19), s.fecreg, 126), s.totn,
                    rtrim(s.codven_nuevo),
                    (select top 1 rtrim(u.nomusu) from fcu0000 u where rtrim(u.codven)=rtrim(s.codven_nuevo)
                     order by case when rtrim(u.codgru)='${GRUPO_VENDEDORES}' then 0 else 1 end, case when u.estado=1 then 0 else 1 end),
                    rtrim(coalesce(c.nomcli, p.nomcli)), rtrim(coalesce(c.mone, p.mone)),
                    case when s.tipo='COT' then ${SITUACION.COT.replace(/\bm\./g,'c.')} else ${SITUACION.PED.replace(/\bm\./g,'p.')} end,
                    (select count(*) from tbl01_api_ajuste_directo x where x.cdocu=s.cdocu and x.ndocu=s.ndocu and x.fecreg<=s.fecreg)
             from tbl01_api_documento_asignado s
             left join mst01cot c on s.tipo='COT' and c.cdocu=s.cdocu and c.ndocu=s.ndocu
             left join mst01ped p on s.tipo='PED' and p.cdocu=s.cdocu and p.ndocu=s.ndocu
             where s.codusu_asigna=@codusu ${extra}
             order by s.fecreg desc, s.id desc`, parametros);

        const {filas, hayMas} = cortar(r.rows, TOPE_LISTA);
        return {hayMas: hayMas, asignados: filas.map(f=>{
            const v = f.map(c=>c.value);
            return {id:v[0], tipo:texto(v[1]), ndocu:v[2], fecreg:v[3], totalConIgv:numero(v[4]),
                    vendedor:{codven:v[5], nombre:v[6]}, cliente:v[7], moneda:v[8],
                    /////en que quedo el documento hoy
                    situacion:texto(v[9]),
                    /////ajustes directos que tuvo antes de asignarlo
                    ajustes:v[10]};
        })};
    });
}

module.exports={directo_documentos, directo_documento, directo_aplicar, directo_vendedores, directo_asignar, ajuste_asignados}
