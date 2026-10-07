const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

// const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
// let {identificador_logeo} = require('../../querys/login/identificador');
///////ESPACIO PARA FUNCIONES GENERALES
let permisos = require('../permisos')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function promo_permisos(req,res,next) {
    try{
        const primera_call= await consulta1(req,next);
        const segunda_call= await consulta2(req,next);
        /////aquie es donde tengo q asignar los permisos segun corresponda
        const tercer_call= await consulta3(primera_call,segunda_call,req,next);
        // const cuarto_call= await obtenerpromesa_conexion();

        res.status(200).json({"status":"ok","codigo":0,"data":tercer_call});
        // res.redirect(tercer_call);
    }
    catch(err){
        error_corrector(res,err);
    }
}

// function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req,next){
    return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req,next))
}

function consulta2(req,next){
    return new Promise((resolve,reject)=>galleta_tipo(resolve,reject,req,next))
}

function consulta3(payload,tipo,req,next){
    return new Promise((resolve,reject)=>ver_permisos(resolve,reject,payload,tipo,req,next))
}

function ver_permisos(resolve,reject,payload,tipo,req,next){
    
    const diferenciador=tipo.toLowerCase();///nose se usara por mientras
    const grupo=payload.id_grupo;
    let accesos_garantizados=[];
    ////deberia ser dinamico usando la url seleccionada asi evitar duplicidad
    for(const access of Object.keys(permisos["promocion"])){
        if(permisos["promocion"][access].includes(parseInt(grupo))){
            accesos_garantizados.push(access);
        }
    }

    resolve(accesos_garantizados);
}

function galleta_credencial(resolve,reject,req,next){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}

function galleta_tipo(resolve,reject,req,next){
    /////esta galleta solo esta firmada no esta en un jws
    let tipo=req.signedCookies.tip;
    if(typeof tipo ==='string'){
        resolve(tipo)
    }
    else{reject("falsa galleta")}
}

module.exports={promo_permisos}