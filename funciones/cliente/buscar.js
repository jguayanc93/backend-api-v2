const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {cliente_buscar} = require('../../querys/cliente/buscar');
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function buscar(req,res,next) {
    try{
        const primera_call= await consulta1(req,next);
        const segundo_call= await obtenerpromesa_conexion();
        const tercer_call= await consulta2(segundo_call,req,next);

        res.status(200).json(JSON.stringify(tercer_call));
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req,next){
    return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req,next))
}

function consulta2(conexion,req,next){
    return new Promise((resolve,reject)=>cliente_buscar(resolve,reject,conexion,req,next))
}

function galleta_credencial(resolve,reject,req,next){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}

module.exports={buscar}