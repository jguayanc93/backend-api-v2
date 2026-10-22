const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {reporte_marcas_mes, reporte_stock_marca, reporte_tiempo_marca, reporte_precios_marca, reporte_guias_marca} = require('../../querys/reportes/informes')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
const {libro, limpio, enviarExcel} = require('../comunes/excel')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Reportes por marca del grupo 25. Los tres informes se piden igual:
/////  POST {"codmar":"0008","formato":"json"}  -> las filas, para verlas en pantalla
/////  POST {"codmar":"0008","formato":"xlsx"}  -> el mismo informe como archivo Excel
/////Si algo falla la respuesta es siempre el JSON de error de siempre, nunca un archivo.

const FORMATOS = ['json','xlsx'];

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

async function correr(req,consulta){
    const payload = req.usuario || leerGalleta(req);
    if(!payload) throw "falsa galleta";
    const conexion = await obtenerpromesa_conexion();
    return new Promise((resolve,reject)=>consulta(resolve,reject,conexion,payload,req.body||{}));
}

async function marcas_reporte(req,res,next){
    try{
        const resultado = await correr(req,reporte_marcas_mes);
        res.status(200).json({"status":"ok","codigo":0,"data":resultado});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function informe(consulta){
    return async function(req,res,next){
        try{
            const formato = String((req.body && req.body.formato) || 'json').trim().toLowerCase();
            if(!FORMATOS.includes(formato)) return error_corrector(res,"formato invalido");

            const resultado = await correr(req,consulta);

            if(formato === 'json') return res.status(200).json({"status":"ok","codigo":0,"data":resultado});

            enviarExcel(res, nombreArchivo(resultado), libro({
                hoja: resultado.informe, columnas: resultado.columnas, filas: resultado.filas,
                fechas: FECHAS, importes: IMPORTES, anchas: ['descripcion'],
                textoNulo: (campo)=>textoNulo(resultado, campo)
            }));
        }
        catch(err){
            error_corrector(res,err);
        }
    };
}

/////stock-EPSON-2026-10.xlsx; guias con su periodo: guias-EPSON-2026-10-01_2026-10-31.xlsx.
function nombreArchivo(r){
    const marca = limpio(r.marca.abrmar || r.marca.codmar);
    if(r.desde) return `${r.informe}-${marca}-${r.desde}_${r.hasta}.xlsx`;
    return `${r.informe}-${marca}-${r.anno}-${String(r.mes).padStart(2,'0')}.xlsx`;
}

/////Columnas que en el Excel llevan formato (ver funciones/comunes/excel.js)
const IMPORTES = ['costoPrincipal','ventaPrincipal','costoMym','ventaMym'];
const FECHAS = ['ultimaCompra','fecha'];

/////En pantalla un null se explica con texto; en el Excel se escribe ese texto en la celda,
/////porque una celda vacia no distingue "no existe" de "se perdio el dato".
function textoNulo(r, campo){
    if(r.informe === 'tiempo' && campo === 'ultimaCompra') return `SIN COMPRA DESDE ${r.kardexDesde}`;
    if(r.informe === 'precios' && (campo === 'costoMym' || campo === 'ventaMym')) return 'SIN ALTA EN M&M';
    return '';
}

module.exports={
    marcas_reporte,
    stock_reporte: informe(reporte_stock_marca),
    tiempo_reporte: informe(reporte_tiempo_marca),
    precios_reporte: informe(reporte_precios_marca),
    guias_reporte: informe(reporte_guias_marca)
}
