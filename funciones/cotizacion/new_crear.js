const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {tipo_cambio} = require('../../querys/cotizacion/tipcambio');
let {num_correlativo} = require('../../querys/cotizacion/correlativo')
let {coti_atencion} = require('../../querys/cotizacion/atencion')
let {coti_cabecera} = require('../../querys/cotizacion/crear_cabecera')
let {coti_detallado} = require('../../querys/cotizacion/crear_detallado')
let {cotizacion_registrar_vendedor} = require('../../querys/cotizacion//otorgar_cotizacion')
let {cotizacion_registrar_tcm} = require('../../querys/cotizacion/otorgar_tcm')
let {recuperar_detallado} = require('../../querys/cotizacion/crear_recuperador')
const {en_transaccion} = require('../../querys/cotizacion/crear_transaccion')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')
const {IGV, CON_IGV} = require('../comunes/constantes')

async function new_creacion(req,res,next) {
    try{
        const primera_call = await consulta1(req,next);//galletas
        const tercer_call = await obtenerpromesa_conexion();
        const cuarta_call = await consulta3(tercer_call);//tipo de cambio
        const activar = await obtenerpromesa_conexion();
        const recuperar_call = await recuperador(activar,req.body["productos"]);///items recuperados de la BD
        const segundo_call = await consulta2(recuperar_call,cuarta_call,req.body["productos"],req.body["moneda"]);//totalisados para la cabecera
        const quinta_call = await obtenerpromesa_conexion();
        const sexta_call = await consulta4(quinta_call);//correlativo actual
        ////POR EL MOMENTTO NO NECESITA ACTUALISAR UNA TABLA DE CORRELATIVO YA QUE NO SE ESTA USANDO PARA NADA
        // const octava_call = await consulta5(setima_call,sexta_call);//actualisar el correlativo en la tabla

        const novena_call = await obtenerpromesa_conexion();
        const decima_call = await consulta6(novena_call,req.body["cliente"][0]);//atencion del cliente
        /////los cuatro pasos que escriben van juntos: cabecera, detalle, vendedor y tipo
        /////de cambio. Antes eran cuatro conexiones sueltas y un fallo a mitad dejaba la
        /////cotizacion sin lineas, o con lineas pero sin dueño.
        const escritura = await obtenerpromesa_conexion();
        await consultaEnTransaccion(escritura,[
            (cx)=>consulta7(cx,cuarta_call,sexta_call,req.body["cliente"],decima_call,segundo_call,req.body["moneda"]),
            (cx)=>consulta8(cx,req.body,segundo_call[0],cuarta_call,sexta_call),
            (cx)=>consulta9(cx,primera_call,sexta_call),
            (cx)=>consulta10(cx,primera_call,sexta_call,cuarta_call[3])
        ]);

        /////se devuelve el ndocu COMPLETO (con serie) porque el frontend lo necesita para
        /////mostrarlo y para encadenar /promocion/acoplar, que exige el numero con serie.
        /////Antes solo salia {"success":true} y ademas doble codificado.
        const tota = Number(Number(segundo_call[1]).toFixed(2));
        const toti = Number((tota * IGV).toFixed(2));
        const totn = Number((tota * CON_IGV).toFixed(2));

        res.status(200).json({"status":"ok","codigo":0,
                              "documento":sexta_call,
                              "lineas":Object.keys(segundo_call[0]).length,
                              "totales":{"tota":tota,"toti":toti,"totn":totn}});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function recuperador(conexion,productos){ return new Promise((resolve,reject)=>recuperar_detallado(resolve,reject,conexion,productos)) }

function consultaEnTransaccion(conexion,pasos){ return new Promise((resolve,reject)=>en_transaccion(resolve,reject,conexion,pasos)) }

function consulta1(req,next){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req,next)) }

function consulta2(recuperada,tipocambio,dataenviada,moneda){ return new Promise((resolve,reject)=>calcular_moneda(resolve,reject,recuperada,tipocambio,dataenviada,moneda)) }

function consulta3(conexion){ return new Promise((resolve,reject)=>tipo_cambio(resolve,reject,conexion)) }

function consulta4(conexion){ return new Promise((resolve,reject)=>num_correlativo(resolve,reject,conexion)) }


function consulta6(conexion,codcli){ return new Promise((resolve,reject)=>coti_atencion(resolve,reject,conexion,codcli)) }

function consulta7(conexion,fecha,formato,info_cliente,atencion,totalisado,moneda){
    return new Promise((resolve,reject)=>coti_cabecera(resolve,reject,conexion,fecha,formato,info_cliente,atencion,totalisado,moneda))
}

function consulta8(conexion,info_cliente,objtotal,fecha,formato){
    return new Promise((resolve,reject)=>coti_detallado(resolve,reject,conexion,info_cliente,objtotal,fecha,formato))
};

function consulta9(conexion,galleta,documento){
    return new Promise((resolve,reject)=>cotizacion_registrar_vendedor(resolve,reject,conexion,galleta,documento))
};

function consulta10(conexion,galleta,documento,tcmer){
    return new Promise((resolve,reject)=>cotizacion_registrar_tcm(resolve,reject,conexion,galleta,documento,tcmer))
}

function galleta_credencial(resolve,reject,req,next){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}

/////Arma el detalle y el totalizado de la cabecera a partir de lo que manda el frontend.
/////
/////IMPORTANTE: los importes llegan SIEMPRE en dolares. El selector de moneda de la
/////pantalla es de presentacion, y `moneda` solo se registra en la cabecera (columna mone).
/////Antes habia una rama if(moneda=="S") que multiplicaba por el tipo de cambio, pero:
/////  - estaba rota: recorria dataenviada["productos"] cuando dataenviada YA es productos,
/////    asi que no iteraba nunca y creaba la cotizacion con total 0 y sin detalle;
/////  - leia indices posicionales, el formato viejo de /create, no los campos con nombre.
/////Convertir aqui duplicaria el importe de toda cotizacion hecha con soles en pantalla.
function calcular_moneda(resolve,reject,recuperada,tipocambio,dataenviada,moneda){
    let objtotal={};
    let totalisado=0;

    for(let indice in dataenviada){
        const codigo=dataenviada[indice]["codigo"];
        if(!Object.keys(recuperada).includes(codigo)) continue;

        /////descripcion, costo, codf y marca salen de la BD, no del cuerpo
        const descripcion=recuperada[codigo][4];
        const costo=recuperada[codigo][6];
        const codf=recuperada[codigo][1];
        const marca=recuperada[codigo][2];

        const cantidad=dataenviada[indice]["cantidad"];
        const preu=dataenviada[indice]["precioUnitario"];
        const dsct=dataenviada[indice]["descuento"];
        const total_solo_item=dataenviada[indice]["preciosinIGV"];
        const total_solo_item_conigv=Number((total_solo_item*CON_IGV).toFixed(2));

        objtotal[codigo]=[codf,marca,descripcion,cantidad,preu,total_solo_item,dsct,total_solo_item_conigv,costo];
        totalisado+=total_solo_item;
    }

    resolve([objtotal,totalisado]);
}

module.exports={new_creacion}