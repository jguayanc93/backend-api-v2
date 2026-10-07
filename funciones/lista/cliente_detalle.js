const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {cliente_detalle} = require('../../querys/lista/cliente_detalle')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Detalle de un cliente. Cuerpo: {"codcli":"C12171"}.
/////
/////Las tres piezas se piden juntas porque la pantalla las necesita a la vez: una sola
/////espera en vez de tres.
async function detalle_cliente(req,res,next) {
    try{
        const payload = leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");

        const conexion = await obtenerpromesa_conexion();
        const datos = await consulta1(conexion,payload,req.body);

        res.status(200).json({"status":"ok","codigo":0,"data":datos});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(conexion,galleta,cuerpo){
    return new Promise((resolve,reject)=>cliente_detalle(resolve,reject,conexion,galleta,cuerpo))
}

module.exports={detalle_cliente}
