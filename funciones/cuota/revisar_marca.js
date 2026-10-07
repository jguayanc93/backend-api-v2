const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
// let {cuota_marca_existe} = require('../../querys/cuota/revisar_registro_marca')
let {revision_rapida_marca_existe} = require('../../querys/cuota/revision_rapida_marca')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function cuota_marca_revisor_rapido(req,res,next) {
    try{
        const primera_call = await consulta1(req);//galletas
        const segunda_call = await obtenerpromesa_conexion();
        const tercera_call = await consulta2(segunda_call,primera_call,req.body);
        // const cuarta_call = await consulta3(tercera_call);
        
        
        res.status(200).json({"procede":tercera_call});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req)) }

function consulta2(conexion,galleta,body){ return new Promise((resolve,reject)=>revision_rapida_marca_existe(resolve,reject,conexion,galleta,body)) }

// function consulta3(vendedor){ return new Promise((resolve,reject)=>manejador_marcas(resolve,reject,vendedor)) }


function galleta_credencial(resolve,reject,req){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}



module.exports={cuota_marca_revisor_rapido}