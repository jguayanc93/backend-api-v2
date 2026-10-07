const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {cuota_existe} = require('../../querys/cuota/revisar_registro')
// let {promo_vertodo} = require('../../querys/promocion/cotizacion')
// let {promo_buscador} = require('../../querys/promocion/buscador')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function cuota_revisar(req,res,next) {
    try{
        const primera_call = await consulta1(req);//galletas
        const segunda_call = await consulta2(primera_call.id_grupo)
        res.redirect(`/v1/cuota/${segunda_call}`)
        // const segunda_call = await obtenerpromesa_conexion();
        // const tercera_call = await consulta2(segunda_call,primera_call);
        
        // res.status(200).json({"permitido":primera_call});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req)) }

function consulta2(grupo){ return new Promise((resolve,reject)=>manejador_grupos(resolve,reject,grupo)) }

function manejador_grupos(resolve,reject,grupo){
    switch (grupo) {
        case "20":
            resolve("simple");
            break;

        case "25":
            resolve("multiple");
            break;

        case "34":
            resolve("superior");
            break;
    
        default:
            resolve("nada")
            break;
    }
}

function galleta_credencial(resolve,reject,req){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}



module.exports={cuota_revisar}