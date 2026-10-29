const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {listaprecios_reporte} = require('../../querys/reportes/listaprecios')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
const {libro, enviarExcel} = require('../comunes/excel')
const {auditarDescarga} = require('../comunes/auditoria')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Lista de precios del grupo 20. Contrato: docs/listaprecios-grupo20.md
/////  POST {"formato":"json"}  -> las filas, para verlas en pantalla
/////  POST {"formato":"xlsx"}  -> la misma lista como archivo Excel
/////Si algo falla la respuesta es siempre el JSON de error de siempre, nunca un archivo.

const FORMATOS = ['json','xlsx'];
const IMPORTES = ['precioSinIgv','precioConIgv'];

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

async function listaprecios_grupo20(req,res,next){
    try{
        const formato = String((req.body && req.body.formato) || 'json').trim().toLowerCase();
        if(!FORMATOS.includes(formato)) return error_corrector(res,"formato invalido");

        const payload = req.usuario || leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");
        const conexion = await obtenerpromesa_conexion();
        const resultado = await new Promise((resolve,reject)=>listaprecios_reporte(resolve,reject,conexion,payload));

        if(formato === 'json') return res.status(200).json({"status":"ok","codigo":0,"data":resultado});

        enviarExcel(res, `lista-precios-${resultado.fecha}.xlsx`, libro({
            hoja: 'lista de precios', columnas: resultado.columnas, filas: resultado.filas,
            importes: IMPORTES, anchas: ['descripcion']
        }));
        /////la lista puede salir a manos de clientes: se deja rastro de cada descarga. El Excel no
        /////pasa por res.json, asi que la auditoria no puede ir como middleware
        auditarDescarga(req, res, 'reporte', 'lista de precios', `xlsx · ${resultado.filas.length} filas`);
    }
    catch(err){
        error_corrector(res,err);
    }
}

module.exports={listaprecios_grupo20}
