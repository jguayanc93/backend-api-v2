const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {anular_cotizacion} = require('../../querys/cotizacion/anular_transaccion')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Da de baja una cotizacion. Es irreversible desde la intranet.
/////
/////Cuerpo: {"ndocu":"009-00971087"} y, opcional, {"motivo":"..."}.
/////El numero va siempre con su serie: conviven 009- y 098-, y uno suelto es ambiguo.
/////
/////Toda la validacion vive en la consulta, dentro de la transaccion: AnulaCotFac no
/////comprueba nada por su cuenta.
async function eliminacion(req,res,next) {
    try{
        const payload = leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");

        const conexion = await obtenerpromesa_conexion();
        const baja = await consulta1(conexion,payload,req.body);

        res.status(200).json({
            "status":"ok", "codigo":0,
            "documento":baja.documento,
            "motivo":baja.motivo
        });
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(conexion,galleta,cuerpo){
    return new Promise((resolve,reject)=>anular_cotizacion(resolve,reject,conexion,galleta,cuerpo))
}

module.exports={eliminacion}
