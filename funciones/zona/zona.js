const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {zona_avance, zona_probabilidad} = require('../../querys/zona/zona')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Jefe de zona (grupo 34). Contrato: docs/zona-grupo34.md
function responder(consulta){
    return async function(req,res,next){
        try{
            const payload = req.usuario || leerGalleta(req);
            if(!payload) return error_corrector(res,"falsa galleta");
            const conexion = await obtenerpromesa_conexion();
            const resultado = await new Promise((resolve,reject)=>consulta(resolve,reject,conexion,payload,Object.assign({},req.query,req.body)));
            res.status(200).json({"status":"ok","codigo":0,"data":resultado});
        }
        catch(err){
            error_corrector(res,err);
        }
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

const avance_zona = responder(zona_avance);
const probabilidad_zona = responder(zona_probabilidad);

module.exports={avance_zona, probabilidad_zona}
