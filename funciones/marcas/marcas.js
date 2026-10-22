const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {marcas_ver} = require('../../querys/marcas/ver')
let {marcas_anterior} = require('../../querys/marcas/anterior')
let {marcas_disponibles} = require('../../querys/marcas/disponibles')
let {marcas_confirmar} = require('../../querys/marcas/confirmar')
let {marcas_asignar, marcas_retirar, marcas_estado} = require('../../querys/marcas/jefatura')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Las siete rutas de /v1/marcas hacen lo mismo: leer la galleta, pedir conexion, correr
/////su consulta y devolver el resultado en "data". Solo cambia la consulta.
function manejador(consulta,responder){
    return async function(req,res,next){
        try{
            const payload = req.usuario || leerGalleta(req);
            if(!payload) return error_corrector(res,"falsa galleta");

            const conexion = await obtenerpromesa_conexion();
            const resultado = await new Promise((resolve,reject)=>consulta(resolve,reject,conexion,payload,req.body||{}));

            (responder||responderOk)(res,resultado);
        }
        catch(err){
            error_corrector(res,err);
        }
    };
}

function responderOk(res,resultado){
    res.status(200).json({"status":"ok","codigo":0,"data":resultado});
}

/////confirmar sin que le quede ninguna marca: no se confirmo, y la pantalla tiene que ver
/////por que se salto cada una
function responderConfirmacion(res,resultado){
    if(!resultado.confirmado){
        return res.status(409).json({"status":"sin marcas asignables","codigo":3,
            "msg":"ninguna de las marcas elegidas se pudo asignar; no se confirmo, elija otras","data":resultado});
    }
    responderOk(res,resultado);
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

module.exports={
    ver_marcas: manejador(marcas_ver),
    anterior_marcas: manejador(marcas_anterior),
    disponibles_marcas: manejador(marcas_disponibles),
    confirmar_marcas: manejador(marcas_confirmar,responderConfirmacion),
    asignar_marcas: manejador(marcas_asignar),
    retirar_marcas: manejador(marcas_retirar),
    estado_marcas: manejador(marcas_estado)
}
