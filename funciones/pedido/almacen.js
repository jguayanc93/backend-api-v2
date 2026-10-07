const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {cambiar_almacen} = require('../../querys/pedido/cambiar_almacen')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Cambia el almacen de un pedido. Cuerpo: {"npedi":"099-00132184","alm":"15"}.
/////Equivale a /cotizacion/almacen, pero aqui el codigo vive tambien en la cabecera.
async function almacen_pedido(req,res,next) {
    try{
        const payload = leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");

        const conexion = await obtenerpromesa_conexion();
        const hecho = await consulta1(conexion,payload,req.body);

        res.status(200).json({
            "status":"ok", "codigo":0,
            "documento":hecho.documento,
            "almacen":hecho.almacen,
            "lineas":hecho.lineas
        });
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(conexion,galleta,cuerpo){
    return new Promise((resolve,reject)=>cambiar_almacen(resolve,reject,conexion,galleta,cuerpo))
}

module.exports={almacen_pedido}
