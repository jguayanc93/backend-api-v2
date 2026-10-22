const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {cuota_marcas_ver, cuota_marcas_fijar} = require('../../querys/cuota/marcas_meta')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Cuota por marca del grupo 25. El contrato para la pantalla esta en docs/cuota-grupo25.md
function manejador(consulta){
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
    };
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

module.exports={
    ver_cuota_marcas: manejador(cuota_marcas_ver),
    fijar_meta_marca: manejador(cuota_marcas_fijar)
}
