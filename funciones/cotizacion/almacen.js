const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {coti_validar_vendedor} = require('../../querys/cotizacion/mostrar_vendedor_registro')
let {almacen_corregido} = require('../../querys/cotizacion/corregir_almacen')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function almacen_cambio(req,res,next) {
    try{
        const primera_call = await consulta1(req,next);//galletas
        const segunda_call = await obtenerpromesa_conexion();
        const tercera_call = await consulta2(segunda_call,primera_call,req.body);
        const quinta_call = await obtenerpromesa_conexion();
        const sexta_call = await consulta3(quinta_call,req.body);

        res.status(200).send(sexta_call);
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req,next){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req,next)) }

function consulta2(conexion,galleta,body){ return new Promise((resolve,reject)=>coti_validar_vendedor(resolve,reject,conexion,galleta,body)) }

function consulta3(conexion,body){ return new Promise((resolve,reject)=>almacen_corregido(resolve,reject,conexion,body)) }


function galleta_credencial(resolve,reject,req,next){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}

function calcular(resolve,reject,dataenviada){
    
    resolve()
}

module.exports={almacen_cambio}