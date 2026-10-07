const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {actualizar_cotizacion} = require('../../querys/cotizacion/actualizar_transaccion')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Reescribe el detalle de una cotizacion abierta del propio vendedor.
/////
/////El documento no viene en un campo propio: sale de la posicion 2 de la primera linea
/////del cuerpo. Por eso se extrae antes de tocar nada y se valida la propiedad con el,
/////no con lo que diga otro campo.
async function modificacion(req,res,next) {
    try{
        const payload = leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");

        const documento = documentoDe(req.body ? req.body.item : null);
        if(!documento) return error_corrector(res,"coti desconocida");

        const conexion = await obtenerpromesa_conexion();
        const hecho = await consulta1(conexion,payload,documento,req.body.item);

        res.status(200).json({
            "status":"ok", "codigo":0,
            "documento":hecho.documento,
            "lineas":hecho.lineas,
            "totales":hecho.totales
        });
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(conexion,galleta,documento,lineas){
    return new Promise((resolve,reject)=>actualizar_cotizacion(resolve,reject,conexion,galleta,documento,lineas))
}

/////El numero de cotizacion y la numeracion de los items se toman del propio cuerpo:
/////la posicion 2 lleva el ndocu y la 8 el numero de item, que se renumera por orden.
function documentoDe(lineas){
    let documento = '';
    let orden = 1;
    for(const indice in lineas){
        lineas[indice][8] = orden;
        if(documento === '') documento = String(lineas[indice][2]||'').trim();
        orden++;
    }
    return documento || null;
}

module.exports={modificacion}
