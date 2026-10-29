const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {quienvender_hoy} = require('../../querys/hoy/quienvender')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////¿A quien vender hoy? del grupo 20. Contrato: docs/quienvender-grupo20.md
/////  GET /quienvender  -> los 3 clientes de hoy (2 para reponer y 1 para llamar)

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

async function quienvender(req,res,next){
    try{
        const payload = req.usuario || leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");
        const conexion = await obtenerpromesa_conexion();
        const resultado = await new Promise((resolve,reject)=>quienvender_hoy(resolve,reject,conexion,payload));
        res.status(200).json({"status":"ok","codigo":0,"data":resultado});
    }
    catch(err){
        error_corrector(res,err);
    }
}

module.exports={quienvender}
