const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {factura_campos} = require('../../querys/factura/campos')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta, tienePermiso} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Los siete campos editables de una factura en una sola llamada.
/////Cuerpo: {"doc":"F009-0649171"}.
/////
/////Cada campo viaja ademas con "puede", que dice si el grupo de quien pregunta tiene
/////permiso para cambiarlo. La pantalla pinta la fila como editable o de solo lectura sin
/////tener que cruzar nada: hoy "vendedor" solo lo tiene jefatura de zona.
const CAMPOS = ['despacho','transporte','atencion','direccion','vendedor','observacion','orden'];

async function facturaxcampos(req,res,next) {
    try{
        const payload = leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");

        const conexion = await obtenerpromesa_conexion();
        const campos = await consulta1(conexion,payload,req.body);

        const permisos = {};
        CAMPOS.forEach(c=>{ permisos[c] = tienePermiso(payload,'factura',c); });

        res.status(200).json({"status":"ok","codigo":0,"data":campos,"puede":permisos});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(conexion,galleta,cuerpo){
    return new Promise((resolve,reject)=>factura_campos(resolve,reject,conexion,galleta,cuerpo))
}

module.exports={facturaxcampos}
