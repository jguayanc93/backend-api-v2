const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {ajuste_previa, ajuste_enviar, ajuste_enviadas, ajuste_recibidas, ajuste_solicitud, ajuste_confirmar, ajuste_rechazar} = require('../../querys/ajuste/ajuste')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta, tienePermiso} = require('../comunes/auth')
const permisos = require('../permisos')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Ajuste de precio de cotizaciones y pedidos. Contrato: docs/ajuste-precios.md
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

/////GET /ajuste: las acciones que su grupo puede usar, con la misma forma que el resto de
/////modulos ({"accesos":[...]}, doble codificado). Grupo 20: enviar y enviadas; grupo 25: recibidas.
function accesos_ajuste(req,res,next){
    const payload = leerGalleta(req);
    if(!payload) return error_corrector(res,"falsa galleta");
    const accesos = Object.keys(permisos.ajuste).filter(accion=>tienePermiso(payload,'ajuste',accion));
    res.status(200).json(JSON.stringify({"accesos":accesos}));
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

module.exports={
    accesos_ajuste,
    previa_ajuste: manejador(ajuste_previa),
    enviar_ajuste: manejador(ajuste_enviar),
    enviadas_ajuste: manejador(ajuste_enviadas),
    recibidas_ajuste: manejador(ajuste_recibidas),
    solicitud_ajuste: manejador(ajuste_solicitud),
    confirmar_ajuste: manejador(ajuste_confirmar),
    rechazar_ajuste: manejador(ajuste_rechazar)
}
