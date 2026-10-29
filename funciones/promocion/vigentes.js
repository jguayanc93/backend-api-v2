const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {promo_vigentes_lista, promo_vigentes_detalle} = require('../../querys/promocion/vigentes')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Promociones vigentes del grupo 20. Contrato: docs/promovigentes-grupo20.md
/////  GET /promocion/vigentes           -> la lista
/////  GET /promocion/vigentes/:idprom   -> una promocion con sus productos

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

async function vigentes_lista(req,res,next){
    try{
        const payload = req.usuario || leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");
        const conexion = await obtenerpromesa_conexion();
        const resultado = await new Promise((resolve,reject)=>promo_vigentes_lista(resolve,reject,conexion,payload));
        res.status(200).json({"status":"ok","codigo":0,"data":resultado});
    }
    catch(err){
        error_corrector(res,err);
    }
}

async function vigentes_detalle(req,res,next){
    try{
        const payload = req.usuario || leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");
        const conexion = await obtenerpromesa_conexion();
        const resultado = await new Promise((resolve,reject)=>promo_vigentes_detalle(resolve,reject,conexion,payload,req.params.idprom));
        res.status(200).json({"status":"ok","codigo":0,"data":resultado});
    }
    catch(err){
        error_corrector(res,err);
    }
}

module.exports={vigentes_lista, vigentes_detalle}
