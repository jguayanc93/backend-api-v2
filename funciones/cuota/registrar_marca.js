const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
// let {cuota_existe} = require('../../querys/cuota/revisar_registro')
// let {registro_cuota} = require('../../querys/cuota/registrar')
let {registro_cuota_marca} = require('../../querys/cuota/registrar_marca')
let {promo_vertodo} = require('../../querys/promocion/cotizacion')
let {promo_buscador} = require('../../querys/promocion/buscador')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function cuota_registrar_marca(req,res,next) {
    try{
        const primera_call = await consulta1(req);//galletas
        const segunda_call = await consulta2(req);
        const tercer_call = await obtenerpromesa_conexion();
        const cuarta_call = await consulta3(tercer_call,primera_call,segunda_call,req.body);
        // const cuarta_call = await obtenerpromesa_conexion();
        // const quinta_call = await consulta3(cuarta_call,tercera_call);
        // const sexta_call = await consulta4(quinta_call);
        
        res.status(200).json({"permitido":cuarta_call});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req)) }

function consulta2(req){ return new Promise((resolve,reject)=>galleta_tipo(resolve,reject,req)) }

function consulta3(conexion,galleta,diferenciador,body){ return new Promise((resolve,reject)=>registro_cuota_marca(resolve,reject,conexion,galleta,diferenciador,body)) }

// function consulta3(conexion,detallado){ return new Promise((resolve,reject)=>promo_buscador(resolve,reject,conexion,detallado)) }

// function consulta4(agrupados){ return new Promise((resolve,reject)=>promocion_agrupados(resolve,reject,agrupados)) }


function galleta_credencial(resolve,reject,req){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}

function galleta_tipo(resolve,reject,req){
    /////esta galleta solo esta firmada no esta en un jws
    let tipo=req.signedCookies.tip;
    if(typeof tipo ==='string'){
        resolve(tipo)
    }
    else{reject("falsa galleta")}
}



module.exports={cuota_registrar_marca}