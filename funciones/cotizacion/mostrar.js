const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {coti_ver} = require('../../querys/cotizacion/ver')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function revisar(req,res,next) {
    try{
        const primera_call = await consulta1(req,next);//galletas
        const segunda_call = await obtenerpromesa_conexion();
        const tercera_call = await consulta2(segunda_call,req,primera_call);
        
        // res.status(200).json(JSON.stringify(tercer_call));
        res.status(200).json(JSON.stringify(tercera_call));
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req,next){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req,next)) }

function consulta2(conexion,req,galleta){ return new Promise((resolve,reject)=>coti_ver(resolve,reject,conexion,req,galleta)) }

function galleta_credencial(resolve,reject,req,next){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}



module.exports={revisar}