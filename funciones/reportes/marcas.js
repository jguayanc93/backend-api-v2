const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {marcas_registradas} = require('../../querys/reportes/marcas')

///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function mostrador_marcas(req,res,next) {
    try{
        const primera_call = await consulta1(req,next);//galletas
        const tercer_call = await obtenerpromesa_conexion();
        const cuarta_call = await consulta3(tercer_call,primera_call);
        const quinta_call = await consulta4(cuarta_call);
        
        res.status(200).json(JSON.stringify(quinta_call));
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req,next){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req,next)) }

function consulta3(conexion,galleta){ return new Promise((resolve,reject)=>marcas_registradas(resolve,reject,conexion,galleta)) }

function consulta4(marcas){ return new Promise((resolve,reject)=>relacionar_marcas(resolve,reject,marcas)) }

function galleta_credencial(resolve,reject,req,next){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}

function relacionar_marcas(resolve,reject,marcas){

    let parseado=JSON.parse(marcas);

    resolve(parseado);
}

module.exports={mostrador_marcas}