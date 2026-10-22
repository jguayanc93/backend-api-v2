const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {cobertura_marcas, cobertura_clientes} = require('../../querys/cobertura/clientes')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
const {libro, limpio, enviarExcel} = require('../comunes/excel')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Cobertura de clientes del grupo 25. El contrato esta en docs/cobertura-grupo25.md

const FORMATOS = ['json','xlsx'];

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

async function correr(req, consulta, cuerpo){
    const payload = req.usuario || leerGalleta(req);
    if(!payload) throw "falsa galleta";
    const conexion = await obtenerpromesa_conexion();
    return new Promise((resolve,reject)=>consulta(resolve,reject,conexion,payload,cuerpo));
}

async function marcas_cobertura(req,res,next){
    try{
        const resultado = await correr(req, cobertura_marcas, Object.assign({},req.query,req.body));
        res.status(200).json({"status":"ok","codigo":0,"data":resultado});
    }
    catch(err){
        error_corrector(res,err);
    }
}

/////GET /cobertura/clientes?codmar=0008            -> JSON, para la pantalla
/////GET /cobertura/clientes?codmar=0008&formato=xlsx -> los mismos clientes en un Excel
/////Si algo falla, siempre el JSON de error de siempre, nunca un archivo.
async function clientes_cobertura(req,res,next){
    try{
        const cuerpo = Object.assign({},req.query,req.body);
        const formato = String(cuerpo.formato || 'json').trim().toLowerCase();
        if(!FORMATOS.includes(formato)) return error_corrector(res,"formato invalido");

        const r = await correr(req, cobertura_clientes, cuerpo);
        if(formato === 'json') return res.status(200).json({"status":"ok","codigo":0,"data":r});

        /////clientes-EPSON-2026-10.xlsx
        const nombre = `clientes-${limpio(r.marca.abrmar || r.marca.codmar)}-${r.anno}-${String(r.mes).padStart(2,'0')}.xlsx`;
        enviarExcel(res, nombre, libro({
            hoja: 'clientes', columnas: r.columnas, filas: r.clientes,
            fechas: ['ultimaCompra'], importes: ['venta'], anchas: ['nombre']
        }));
    }
    catch(err){
        error_corrector(res,err);
    }
}

module.exports={marcas_cobertura, clientes_cobertura}
