const {Request,TYPES} = require('../../conexion/cadena');
const {normalizarNdocu} = require('../../funciones/comunes/constantes');
/////mientras un especialista ajusta sus precios, el vendedor no toca el documento
const {enAjuste} = require('../ajuste/ajuste');

/////Convierte una cotizacion APROBADA en un pedido de la serie 098-, como lo hace el ERP
/////(revisado en bdnava08 el 18/11/2026):
/////
/////  - la cabecera sale de GrabaMstPedFac y cada linea de GrabaDtlPedFac. Ninguno de los
/////    dos valida nada, asi que todas las comprobaciones se hacen aqui, dentro de una
/////    sola transaccion: si algo falla no queda ni el pedido a medias ni la coti marcada.
/////
/////  - el pedido nace SIN aprobar (apro='0') y espera que lo aprueben en el ERP. Por eso
/////    no separa stock: las lineas van con pedi=0 (la cantidad en cant) y prdXX.pedi no se
/////    toca. Al aprobar, el ERP pone pedi y separa; asi estan los pedidos apro 0 vivos.
/////
/////  - se copian todas las lineas de la coti tal cual, tambien las de promocion
/////    (0303-010001 y GRATIS/PROM), con su precio, su costo y su almacen. Cada linea
/////    conserva su almacen aunque la coti los mezcle (85 de 6717 cotis abiertas lo hacen).
/////
/////  - la coti queda flag='1', cdge='32', ndge=<pedido>. El estado NO se toca: ya es '3'
/////    y el trigger PromoFlete de mst01cot solo actua cuando cambia el estado.
/////
/////Solo se puede convertir una coti aprobada (estado '3'), abierta (flag '0') y sin
/////documento generado (cdge/ndge vacios). Si ya genero un pedido, una factura o una
/////boleta, no se le crea otro.
/////
/////Los datos de despacho los elige el vendedor:
/////  - tipo de entrega: 1 ventanilla, 3 Lima, 4 provincia
/////  - transportista: en ventanilla y Lima va fijo T0001; en provincia se elige
/////  - direccion de entrega: una de las del cliente (mst01cli y Dtl_Cliente_Alias)
/////  - consignatario: un nombre, texto libre
/////  - observacion: texto libre; se guarda con la forma de los pedidos 099

const SERIE = "098-";
const LARGO = 8;
const CDOCU_COTI = '31';
const CDOCU_PEDIDO = '32';

/////tipo de entrega -> transportista fijo (null = lo elige el vendedor)
const TIPOS_ENTREGA = {
    1:{transportista:'T0001'},   ////Desp.Ventanilla
    3:{transportista:'T0001'},   ////Desp. Local (Lima)
    4:{transportista:null}       ////Desp. Provincia
};
const TRANSPORTISTA_PROPIO = 'T0001';

const LARGO_CONSIG = 60;     ////mst01ped.Consig varchar(60)
const LARGO_OBSE = 254;      ////mst01ped.obse varchar(254)
const LARGO_DIRENT = 250;    ////mst01ped.dirent char(250)

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
/////el rowCount de tedious cuenta result sets, no filas afectadas
function ejecutarContando(conexion, sql, parametros){
    return ejecutar(conexion, sql+"; select @@ROWCOUNT as afectadas;", parametros)
        .then(r => (r.length ? Number(r[r.length-1][0].value) : 0));
}
function llamarProcedimiento(conexion, nombre, parametros){
    return new Promise((resolve,reject)=>{
        const consulta = new Request(nombre,(err)=>err?reject(err):resolve());
        (parametros||[]).forEach(p=>consulta.addParameter(p.nombre,p.tipo,p.valor));
        conexion.callProcedure(consulta);
    });
}
function iniciar(conexion){
    return new Promise((res,rej)=>conexion.beginTransaction(e=>e?rej(e):res(),'coti_a_pedido'));
}
function confirmar(conexion){
    return new Promise((res,rej)=>conexion.commitTransaction(e=>e?rej(e):res()));
}
function revertir(conexion){
    /////no se propaga el error del rollback: ya estamos en el camino de fallo
    return new Promise((res)=>conexion.rollbackTransaction(()=>res()));
}

const texto = (v)=>String(v == null ? '' : v).trim();
const p = (nombre,tipo,valor)=>({nombre,tipo,valor});

/////Cabecera de la coti, con lo que hace falta del cliente. Con bloquear, queda tomada
/////hasta el fin de la transaccion: dos conversiones a la vez de la misma coti esperan
/////una a la otra y la segunda ya la encuentra convertida.
const CABECERA =
    "select rtrim(c.flag), rtrim(c.estado), rtrim(isnull(c.cdge,'')), rtrim(isnull(c.ndge,'')),"+
    " rtrim(c.codcli), rtrim(c.nomcli), rtrim(c.ruccli), rtrim(isnull(c.atte,'')),"+
    " rtrim(c.mone), c.tcam, c.tota, c.toti, c.totn, rtrim(c.codven), rtrim(c.codven_usu),"+
    " rtrim(isnull(c.codscc,'')), isnull(c.tcme,0),"+
    " rtrim(isnull(k.codcdv,'')), isnull(v.diaven,0),"+
    " cast(cast(getdate() as date) as datetime),"+
    /////antiguedad: dias desde la emision hasta hoy SIN contar los domingos.
    /////DATEDIFF(week) cuenta los domingos de (emision, hoy] sea cual sea DATEFIRST
    " datediff(day, cast(c.fecha as date), cast(getdate() as date))"+
    "  - datediff(week, cast(c.fecha as date), cast(getdate() as date))"+
    " from mst01cot c %BLOQUEO%"+
    " left join mst01cli k on k.codcli=c.codcli"+
    " left join tbl01cdv v on v.codcdv=k.codcdv"+
    " where c.cdocu='"+CDOCU_COTI+"' and c.ndocu=@coti and c.codven_usu=@codven";

async function leerCabecera(conexion, coti, codven, bloquear){
    const filas = await ejecutar(conexion,
        CABECERA.replace('%BLOQUEO%', bloquear ? 'with (updlock, holdlock)' : ''),
        [p('coti',TYPES.VarChar,coti), p('codven',TYPES.VarChar,codven)]);
    if(filas.length === 0) return null;
    const v = filas[0].map(c=>c.value);
    return {
        flag:v[0], estado:v[1], cdge:v[2], ndge:v[3],
        codcli:v[4], nomcli:v[5], ruccli:v[6], atte:v[7],
        mone:v[8], tcam:Number(v[9]), tota:Number(v[10]), toti:Number(v[11]), totn:Number(v[12]),
        codven:v[13], codven_usu:v[14], codscc:v[15], tcme:Number(v[16]),
        codcdv:v[17], dias:Number(v[18]), hoy:v[19], antiguedad:Number(v[20])
    };
}

/////Plazo para pasar a pedido (pedido por el frontend el 19/11/2026): hasta 5 dias de
/////antiguedad sin contar el domingo. La de hoy tiene 0; con 6 o mas ya no se pasa.
/////Solo se salta el domingo: Tbl_Diaferiado existe en el ERP pero tiene una sola fila
/////(2010) y nada la usa.
const PLAZO_DIAS = 5;

/////Devuelve el motivo por el que no se puede convertir, o null si se puede.
/////flag:   '0' abierta · '1' ya genero documento · '*' anulada
/////estado: '0' sin aprobar · '3' aprobada
/////Si hay varios, gana el primero en este orden (lo pidio el frontend): convertida,
/////anulada, fuera de plazo, sin aprobar. El ajuste se mira despues, aparte.
/////El plazo va antes que «sin aprobar» porque eso se arregla esperando y el plazo no.
function porQueNoSePuede(cab){
    if(cab.flag === '1' || cab.ndge !== '' || cab.cdge !== '') return "coti ya convertida";
    if(cab.flag === '*') return "coti ya anulada";
    if(cab.flag !== '0') return "coti ya convertida";
    if(cab.antiguedad > PLAZO_DIAS) return "coti fuera de plazo";
    if(cab.estado !== '3') return "coti sin aprobar";
    return null;
}

/////Las direcciones de entrega del cliente: la suya y las de sus alias.
const DIRECCIONES =
    "select distinct ltrim(rtrim(dirent)) from ("+
    "   select dirent from mst01cli where codcli=@cliente"+
    "   union all"+
    "   select dirent from Dtl_Cliente_Alias where codcli=@cliente"+
    ") d where ltrim(rtrim(isnull(dirent,'')))<>''";

async function direcciones(conexion, codcli){
    const filas = await ejecutar(conexion, DIRECCIONES, [p('cliente',TYPES.VarChar,codcli)]);
    return filas.map(f=>f[0].value);
}

/////El numero del pedido. Sale de dbo.seq_pedido_098, que lo entrega de forma atomica.
/////Si la secuencia no existe en esta base, o quedo por detras de mst01ped, se usa el
/////maximo + 1 con la tabla bloqueada (estamos dentro de la transaccion) y se avisa en el
/////log para reajustarla. Script: querys/sp/seq_pedido_098.sql
const NUMERO =
    "declare @n int, @usado bit = 0, @fuente varchar(10) = 'secuencia';"+
    " if object_id('dbo.seq_pedido_098','SO') is not null"+
    "   exec sp_executesql N'select @n = next value for dbo.seq_pedido_098', N'@n int output', @n output;"+
    " if @n is not null and exists(select 1 from mst01ped where ndocu='"+SERIE+"'+right(replicate('0',"+LARGO+")+cast(@n as varchar("+LARGO+")),"+LARGO+"))"+
    "   set @usado = 1;"+
    " if @n is null or @usado = 1"+
    " begin"+
    "   select @n = isnull(max(cast(right(ndocu,"+LARGO+") as int)),0)+1 from mst01ped with (updlock, holdlock) where left(ndocu,3)='098';"+
    "   set @fuente = case when @usado = 1 then 'atrasada' else 'maximo' end;"+
    " end"+
    " select '"+SERIE+"'+right(replicate('0',"+LARGO+")+cast(@n as varchar("+LARGO+")),"+LARGO+"), @fuente;";

async function siguienteNumero(conexion){
    const fila = (await ejecutar(conexion, NUMERO))[0];
    const numero = fila[0].value, fuente = fila[1].value;
    if(fuente === 'atrasada'){
        console.warn("[coti_a_pedido] la secuencia seq_pedido_098 va por detras de mst01ped; se uso "+numero+
                     ". Reajustar con ALTER SEQUENCE dbo.seq_pedido_098 RESTART WITH <ultimo 098- + 1>");
    }else if(fuente === 'maximo'){
        console.warn("[coti_a_pedido] no existe seq_pedido_098 en esta base; se uso el maximo + 1 ("+numero+")");
    }
    return numero;
}

/////Lineas vivas de la coti, en su orden
const LINEAS =
    "select item, rtrim(codi), rtrim(codf), rtrim(marc), rtrim(umed), rtrim(descr), cant, preu, cost,"+
    " tota, dsct, totn, rtrim(codalm), rtrim(moneitm), rtrim(aigv), rtrim(isnull(msto,'S')), rtrim(mone), tcam"+
    " from dtl01cot where cdocu='"+CDOCU_COTI+"' and ndocu=@coti and flag<>'*' order by item";

/////El despacho que manda el vendedor, comprobado. Devuelve {rechazo} o los datos limpios.
async function validarDespacho(conexion, cuerpo, codcli){
    const tipent = parseInt(cuerpo.tipent, 10);
    const tipo = TIPOS_ENTREGA[tipent];
    if(!tipo) return {rechazo:"tipo entrega invalido"};

    /////transportista: fijo en ventanilla y Lima; en provincia, uno activo de tbl01tra
    let codtra = tipo.transportista;
    let nomtra = '';
    if(!codtra){
        codtra = texto(cuerpo.codtra).toUpperCase();
        if(!codtra) return {rechazo:"transportista invalido"};
    }
    const tra = await ejecutar(conexion,
        "select rtrim(nomtra) from tbl01tra where codtra=@codtra and estado=1",
        [p('codtra',TYPES.VarChar,codtra)]);
    if(tra.length === 0) return {rechazo:"transportista invalido"};
    nomtra = tra[0][0].value;

    /////direccion: tiene que ser una de las del cliente, tal cual
    const dirent = texto(cuerpo.dirent);
    if(!dirent) return {rechazo:"direccion invalida"};
    const suyas = await direcciones(conexion, codcli);
    if(!suyas.includes(dirent)) return {rechazo:"direccion invalida"};

    const consig = texto(cuerpo.consig).slice(0, LARGO_CONSIG);
    const nota = texto(cuerpo.obse);

    return {
        tipent, codtra, nomtra,
        dirent: dirent.slice(0, LARGO_DIRENT),
        consig,
        obse: armarObservacion(tipent, consig, nomtra, nota)
    };
}

/////La observacion con la forma de los pedidos 099 de la web:
/////    "DNI.<dni> ATC.<nombre> CEL.<cel>df. <destino> transporte. <transportista>obse.<texto>"
/////De ahi se toma lo que la intranet conoce: el consignatario (un nombre, sin DNI ni
/////celular), el transportista solo en provincia (como en los 099) y el texto del vendedor.
/////Sin consignatario no se escribe la parte "ATC.".
function armarObservacion(tipent, consig, nomtra, nota){
    let obse = consig ? "ATC." + consig + " " : "";
    if(tipent === 4) obse += "transporte. " + nomtra + " ";
    obse += "obse." + nota;
    return obse.slice(0, LARGO_OBSE);
}

let convertir_pedido = async (resolve,reject,conexion,galleta,cuerpo)=>{
    const codven = galleta ? galleta.codigo : null;
    const coti = normalizarNdocu(cuerpo ? cuerpo.ndocu : null);

    if(!codven){ conexion.close(); return reject("falsa galleta"); }
    if(!coti){ conexion.close(); return reject("documento ambiguo"); }

    let abierta = false;
    const salir = async (motivo)=>{
        if(abierta){ await revertir(conexion); abierta = false; }
        conexion.close();
        reject(motivo);
    };

    try{
        await iniciar(conexion);
        abierta = true;

        /////1) la coti: existir, ser suya, estar aprobada y sin documento generado
        const cab = await leerCabecera(conexion, coti, codven, true);
        if(!cab) return salir("coti desconocida");
        const negativa = porQueNoSePuede(cab);
        if(negativa) return salir(negativa);
        if(await enAjuste(conexion, coti)) return salir("documento en ajuste");

        const lineas = (await ejecutar(conexion, LINEAS, [p('coti',TYPES.VarChar,coti)]))
            .map(f=>f.map(c=>c.value));
        if(lineas.length === 0) return salir("cotizacion vacia");

        /////2) el despacho
        const desp = await validarDespacho(conexion, cuerpo, cab.codcli);
        if(desp.rechazo) return salir(desp.rechazo);

        /////3) el numero
        const pedido = await siguienteNumero(conexion);

        /////4) la cabecera, con el procedimiento del ERP. Recibe dirent en char(60) y nomsol
        /////   en char(40), asi que los dos se reescriben enteros en el paso 5.
        await llamarProcedimiento(conexion, 'GrabaMstPedFac', [
            p('fecha',TYPES.DateTime,cab.hoy),
            p('cdocu',TYPES.Char,CDOCU_PEDIDO),
            p('ndocu',TYPES.Char,pedido),
            p('codcli',TYPES.Char,cab.codcli),
            p('nomcli',TYPES.Char,cab.nomcli.slice(0,60)),
            p('dirent',TYPES.Char,desp.dirent.slice(0,60)),
            p('ruccli',TYPES.Char,cab.ruccli.slice(0,11)),
            p('nomsol',TYPES.Char,cab.atte.slice(0,40)),
            p('crefe',TYPES.Char,CDOCU_COTI),
            p('nrefe',TYPES.Char,coti),
            p('orde',TYPES.Char,''),
            p('mone',TYPES.Char,cab.mone),
            p('tcam',TYPES.Float,cab.tcam),
            p('tota',TYPES.Float,cab.tota),
            p('toti',TYPES.Float,cab.toti),
            p('totn',TYPES.Float,cab.totn),
            p('flag',TYPES.Char,'0'),
            p('codven',TYPES.Char,cab.codven),
            p('codcdv',TYPES.Char,cab.codcdv),
            p('dias',TYPES.Float,cab.dias),
            p('apro',TYPES.Char,'0'),
            p('cOperacion',TYPES.Char,'Nuevo'),
            p('fent',TYPES.DateTime,cab.hoy),
            p('codalm',TYPES.Char,lineas[0][12]),
            p('codscc',TYPES.Char,cab.codscc || '00')
        ]);

        /////5) lo que el procedimiento no recibe. Se hace ANTES de grabar las lineas: el
        /////   trigger de UPDATE de mst01ped recalcula totales si ya hay lineas de promocion.
        const cabeceraOk = await ejecutarContando(conexion,
            "update mst01ped set dirent=@dirent, nomsol=@nomsol, TipEnt=@tipent, CodTra=@codtra,"+
            " Consig=@consig, obse=@obse, tipped=1, tipdes=1, codven_usu=@codven_usu, codpto='01',"+
            " FecReg=getdate(), tcme=@tcme, origen=0, idUsuario=0"+
            " where cdocu='"+CDOCU_PEDIDO+"' and ndocu=@pedido",
            [p('dirent',TYPES.VarChar,desp.dirent),
             p('nomsol',TYPES.VarChar,cab.atte.slice(0,50)),
             p('tipent',TYPES.Int,desp.tipent),
             p('codtra',TYPES.VarChar,desp.codtra),
             p('consig',TYPES.VarChar,desp.consig),
             p('obse',TYPES.VarChar,desp.obse),
             p('codven_usu',TYPES.VarChar,cab.codven_usu),
             p('tcme',TYPES.Float,cab.tcme),
             p('pedido',TYPES.VarChar,pedido)]);
        if(cabeceraOk !== 1) return salir("pedido no creado");

        /////6) las lineas, una por una: los triggers de dtl01ped leen una sola fila de inserted
        for(const l of lineas){
            await llamarProcedimiento(conexion, 'GrabaDtlPedFac', [
                p('fecha',TYPES.DateTime,cab.hoy),
                p('cdocu',TYPES.Char,CDOCU_PEDIDO),
                p('ndocu',TYPES.Char,pedido),
                p('codcli',TYPES.Char,cab.codcli),
                p('tcam',TYPES.Float,Number(l[17])),
                p('mone',TYPES.Char,l[16]),
                p('moneitm',TYPES.Char,l[13]),
                p('aigv',TYPES.Char,l[14]),
                p('item',TYPES.Float,Number(l[0])),
                p('codi',TYPES.Char,l[1]),
                p('codf',TYPES.Char,l[2]),
                p('marc',TYPES.Char,l[3]),
                p('umed',TYPES.Char,l[4]),
                p('descr',TYPES.Char,l[5].slice(0,80)),
                p('pedi',TYPES.Float,0),               ////sin aprobar: no separa
                p('cant',TYPES.Float,Number(l[6])),
                p('preu',TYPES.Float,Number(l[7])),
                p('cost',TYPES.Float,Number(l[8])),
                p('tota',TYPES.Float,Number(l[9])),
                p('dsct',TYPES.Float,Number(l[10])),
                p('totn',TYPES.Float,Number(l[11])),
                p('AnulaDetalle',TYPES.Char,'N'),
                p('codalm',TYPES.Char,l[12]),
                p('uvta',TYPES.Int,0),
                p('umedu',TYPES.Char,''),
                p('msto',TYPES.Char,l[15])
            ]);
        }

        /////7) la coti queda con su documento generado. El estado no se toca (ver arriba).
        const marcada = await ejecutarContando(conexion,
            "update mst01cot set flag='1', cdge='"+CDOCU_PEDIDO+"', ndge=@pedido"+
            " where cdocu='"+CDOCU_COTI+"' and ndocu=@coti and flag='0' and estado='3'"+
            " and ltrim(rtrim(isnull(ndge,'')))=''",
            [p('pedido',TYPES.VarChar,pedido), p('coti',TYPES.VarChar,coti)]);
        if(marcada !== 1) return salir("coti ya convertida");

        /////8) comprobar lo que quedo antes de confirmar
        const control = (await ejecutar(conexion,
            "select (select count(*) from dtl01ped where cdocu='"+CDOCU_PEDIDO+"' and ndocu=@pedido),"+
            " tota, toti, totn, rtrim(apro) from mst01ped where cdocu='"+CDOCU_PEDIDO+"' and ndocu=@pedido",
            [p('pedido',TYPES.VarChar,pedido)]))[0];
        if(!control || Number(control[0].value) !== lineas.length) return salir("pedido no creado");

        await confirmar(conexion); abierta = false;
        conexion.close();
        resolve({
            pedido: pedido,
            cotizacion: coti,
            aprobado: false,
            lineas: lineas.length,
            moneda: cab.mone,
            totales: {tota:Number(control[1].value), toti:Number(control[2].value), totn:Number(control[3].value)},
            despacho: {tipent:desp.tipent, codtra:desp.codtra, transportista:desp.nomtra,
                       dirent:desp.dirent, consig:desp.consig, obse:desp.obse}
        });
    }
    catch(err){
        console.error("[convertir_pedido]",err);
        if(abierta) await revertir(conexion);
        conexion.close();
        reject("error query");
    }
}

/////Lo que la pantalla necesita para armar el despacho de una coti: si se puede convertir
/////(y si no, por que), las direcciones del cliente, los tipos de entrega con su
/////transportista fijo, y la atencion de la coti como sugerencia de consignatario.
let opciones_pedido = async (resolve,reject,conexion,galleta,cuerpo)=>{
    const codven = galleta ? galleta.codigo : null;
    const coti = normalizarNdocu(cuerpo ? cuerpo.ndocu : null);

    if(!codven){ conexion.close(); return reject("falsa galleta"); }
    if(!coti){ conexion.close(); return reject("documento ambiguo"); }

    try{
        const cab = await leerCabecera(conexion, coti, codven, false);
        if(!cab){ conexion.close(); return reject("coti desconocida"); }

        let motivo = porQueNoSePuede(cab);
        if(!motivo && await enAjuste(conexion, coti)) motivo = "documento en ajuste";

        const dirs = await direcciones(conexion, cab.codcli);
        const tipos = (await ejecutar(conexion,
            "select IDdespacho, rtrim(despacho) from tbl_tipo_despacho where estado=1 and IDdespacho in ("+
            Object.keys(TIPOS_ENTREGA).join(',')+") order by IDdespacho"))
            .map(f=>({
                tipent: f[0].value,
                nombre: f[1].value,
                transportista: TIPOS_ENTREGA[f[0].value].transportista   ////null: lo elige el vendedor
            }));

        conexion.close();
        resolve({
            documento: coti,
            convertible: !motivo,
            motivo: motivo,
            antiguedad: cab.antiguedad,    ////dias sin contar domingos; se puede hasta PLAZO_DIAS
            plazo: PLAZO_DIAS,
            documento_generado: cab.ndge ? {cdocu:cab.cdge, ndocu:cab.ndge} : null,
            cliente: {codcli:cab.codcli, nomcli:cab.nomcli},
            consignatario_sugerido: cab.atte,
            direcciones: dirs,
            tipos_entrega: tipos
        });
    }
    catch(err){
        console.error("[opciones_pedido]",err);
        conexion.close();
        reject("error query");
    }
}

module.exports={convertir_pedido, opciones_pedido, TRANSPORTISTA_PROPIO};
