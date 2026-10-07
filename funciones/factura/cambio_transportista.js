const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {factura_sugerencia_transportista} = require('../../querys/factura/transportista_sugerencia')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Las opciones de transportista. Devuelve {total, data}: el total dice cuantas hay en total
/////aunque solo viajen las primeras, para que la pantalla pueda decir "5 de 23".
async function facturaxtransportistaxsugerencia(req,res,next) {
    try{
        const payload = leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");

        const conexion = await obtenerpromesa_conexion();
        const lista = await consulta1(conexion,req.body);

        res.status(200).json({"status":"ok","codigo":0,"total":lista.total,"data":lista.data});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(conexion,cuerpo){
    return new Promise((resolve,reject)=>factura_sugerencia_transportista(resolve,reject,conexion,cuerpo))
}

module.exports={facturaxtransportistaxsugerencia}
