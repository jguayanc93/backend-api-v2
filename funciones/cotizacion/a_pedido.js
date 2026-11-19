const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
const {convertir_pedido, opciones_pedido} = require('../../querys/cotizacion/a_pedido')
const {factura_sugerencia_transportista} = require('../../querys/factura/transportista_sugerencia')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Pasar una cotizacion aprobada a pedido (serie 098-). Toda la logica y sus porques
/////estan en querys/cotizacion/a_pedido.js.
/////
/////POST /cotizacion/pedido
/////    {"ndocu":"098-00000055","tipent":3,"dirent":"AV. ...","consig":"JUAN PEREZ","obse":"..."}
/////    en provincia (tipent 4) ademas "codtra":"T0106"; en ventanilla y Lima va T0001 fijo
/////POST /cotizacion/pedido/opciones   {"ndocu":"098-00000055"}
/////    si se puede convertir, direcciones del cliente y tipos de entrega
/////POST /cotizacion/pedido/transportista   {"sugerencia":"shalom"}
/////    transportistas activos, de cinco en cinco (la misma lista que en factura)

async function pasar_pedido(req,res,next){
    try{
        const conexion = await obtenerpromesa_conexion();
        const r = await new Promise((resolve,reject)=>convertir_pedido(resolve,reject,conexion,req.usuario,req.body||{}));
        res.status(200).json(Object.assign({"status":"ok","codigo":0}, r));
    }
    catch(err){
        error_corrector(res,err);
    }
}

async function opciones_despacho(req,res,next){
    try{
        const conexion = await obtenerpromesa_conexion();
        const r = await new Promise((resolve,reject)=>opciones_pedido(resolve,reject,conexion,req.usuario,req.body||{}));
        res.status(200).json(Object.assign({"status":"ok","codigo":0}, r));
    }
    catch(err){
        error_corrector(res,err);
    }
}

async function transportistas(req,res,next){
    try{
        const conexion = await obtenerpromesa_conexion();
        const r = await new Promise((resolve,reject)=>factura_sugerencia_transportista(resolve,reject,conexion,req.body||{}));
        res.status(200).json(r);
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

module.exports={pasar_pedido, opciones_despacho, transportistas}
