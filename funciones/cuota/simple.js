const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {cuota_existe} = require('../../querys/cuota/revisar_registro')
let {promo_vertodo} = require('../../querys/promocion/cotizacion')
let {promo_buscador} = require('../../querys/promocion/buscador')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function cuota_simple(req,res,next) {
    try{
        const primera_call = await consulta1(req);//galletas
        const segunda_call = await obtenerpromesa_conexion();
        const tercera_call = await consulta2(segunda_call,primera_call);
        // const cuarta_call = await obtenerpromesa_conexion();
        // const quinta_call = await consulta3(cuarta_call,tercera_call);
        // const sexta_call = await consulta4(quinta_call);
        
        /////las dos salidas son 200: "ya la registraste" es un dato, no un fallo.
        /////`simple` conserva el texto que devolvia antes para no romper lo que ya lo lea.
        res.status(200).json({"status":"ok","codigo":0,
                              "simple":tercera_call.estado,
                              "puedeRegistrar":tercera_call.puedeRegistrar,
                              "yaRegistrada":tercera_call.yaRegistrada,
                              "monto":tercera_call.monto});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req)) }

function consulta2(conexion,galleta){ return new Promise((resolve,reject)=>cuota_existe(resolve,reject,conexion,galleta)) }

function consulta3(conexion,detallado){ return new Promise((resolve,reject)=>promo_buscador(resolve,reject,conexion,detallado)) }


function galleta_credencial(resolve,reject,req){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}



module.exports={cuota_simple}