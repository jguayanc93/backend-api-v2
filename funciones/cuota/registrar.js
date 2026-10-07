const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {cuota_existe} = require('../../querys/cuota/revisar_registro')
let {registro_cuota} = require('../../querys/cuota/registrar')
let {promo_vertodo} = require('../../querys/promocion/cotizacion')
let {promo_buscador} = require('../../querys/promocion/buscador')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function cuota_registrar(req,res,next) {
    try{
        const primera_call = await consulta1(req);//galletas
        const segunda_call = await consulta2(req);
        const quinta_call = await consulta4(req.body);///lo que regresa es el codfam
        const tercer_call = await obtenerpromesa_conexion();
        const cuarta_call = await consulta3(tercer_call,primera_call,segunda_call,req.body,quinta_call);
        // const cuarta_call = await obtenerpromesa_conexion();
        // const quinta_call = await consulta3(cuarta_call,tercera_call);
        
        res.status(200).json({"status":"ok","codigo":0,"permitido":true,"cuota":cuarta_call.cuota,"family":cuarta_call.family,"objetivo":cuarta_call.objetivo});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req)) }

function consulta2(req){ return new Promise((resolve,reject)=>galleta_tipo(resolve,reject,req)) }

function consulta3(conexion,galleta,diferenciador,body,codfam){ return new Promise((resolve,reject)=>registro_cuota(resolve,reject,conexion,galleta,diferenciador,body,codfam)) }

function consulta4(body){ return new Promise((resolve,reject)=>familia_descrifador(resolve,reject,body)) }

function familia_descrifador(resolve,reject,body){
    let codfam=body.objetivo_especial;
    switch(codfam){
        case 'ACCESORIOS Y PERIFERICOS':
            resolve('01');
            break;
        case 'EQUIPOS INFORMATICOS':
            resolve('02');
            break;
        case 'COMPONENTES':
            resolve('06');
            break;
        case 'ALM. EXTERNO':
            resolve('09');
            break;
        case 'IMPRESION':
            resolve('11');
            break;
        case 'TELEFONIA':
            resolve('12');
            break;
        default:
            resolve('06');
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

function galleta_tipo(resolve,reject,req){
    /////esta galleta solo esta firmada no esta en un jws
    let tipo=req.signedCookies.tip;
    if(typeof tipo ==='string'){
        resolve(tipo)
    }
    else{reject("falsa galleta")}
}



module.exports={cuota_registrar}