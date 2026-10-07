const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {cuota_existe} = require('../../querys/cuota/revisar_registro')
let {registro_cuota} = require('../../querys/cuota/registrar')
let {cuota_tiempo} = require('../../querys/cuota/mostrar')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function cuota_direccionador(req,res,next) {
    try{
        const primera_call = await consulta1(req);//galletas
        const segunda_call = await consulta2(req);
        const tercera_call = await consulta4(primera_call,segunda_call);
        
        res.redirect(`/v1/cuota/${tercera_call}`)
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req)) }

function consulta2(req){ return new Promise((resolve,reject)=>galleta_tipo(resolve,reject,req)) }

function consulta3(conexion,galleta,diferenciador){ return new Promise((resolve,reject)=>cuota_tiempo(resolve,reject,conexion,galleta,diferenciador)) }

function consulta4(galleta,diferenciador){ return new Promise((resolve,reject)=>tipo_direccionador(resolve,reject,galleta,diferenciador)) }


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

/////Solo tres tipos de vendedor tienen cuota. Comprobado en la base: en toda la historia
/////de tbl_api_vendedores_meta solo hay metas de COBERTURA y CARTERA, y especialista va
/////por su propia ruta de marcas. A JEFATURA, ZONA y HP nunca se les cargo una.
/////
/////Antes caian en "error inesperado" y acababan en un 404, con lo que la pantalla no
/////podia distinguir entre "la ruta no existe", "el servidor esta mal" y "a esta persona
/////no le toca cuota". Ahora se rechaza con un motivo que se puede explicar.
const CON_CUOTA = ['COBERTURA','CARTERA','ESPECIALISTA'];

function tipo_direccionador(resolve,reject,galleta,diferenciador){
    const tipo = String(diferenciador==null ? '' : diferenciador).trim().toUpperCase();
    if(CON_CUOTA.includes(tipo)) return resolve(tipo.toLowerCase());
    return reject("cuota no corresponde");
}



module.exports={cuota_direccionador}