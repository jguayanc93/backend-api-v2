const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();
const XLSX = require('xlsx');

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {reporte_precios} = require('../../querys/reportes/reporte_precios')

///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function marcas_precios(req,res,next) {
    try{
        const primera_call = await consulta1(req,next);//galletas
        const tercer_call = await obtenerpromesa_conexion();
        const cuarta_call = await consulta3(tercer_call,req.body);
        const quinta_call = await consulta4(cuarta_call);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition','attachment; filename="tiempo.xlsx"');
        res.status(200).send(quinta_call);
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req,next){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req,next)) }

function consulta3(conexion,body){ return new Promise((resolve,reject)=>reporte_precios(resolve,reject,conexion,body)) }

function consulta4(reporte){ return new Promise((resolve,reject)=>relacionar_marcas(resolve,reject,reporte)) }

function galleta_credencial(resolve,reject,req,next){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}

function relacionar_marcas(resolve,reject,respuesta){

    const worksheet=XLSX.utils.json_to_sheet(respuesta);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook,worksheet,"stocc");
    ///////cabesera
    XLSX.utils.sheet_add_aoa(worksheet,[["CODF","DESCRIPCION","FAMILIA","PART NUMBER","COSTO PRINCIPAL","VENTA PRINCIPAL","COSTO MYM","VENTA MYM"]],{origin:"A1"});
    ///columna anchura
    worksheet["!cols"]=[{wch:16}];
    ///////////BUFFER DE DATA CONVERTIDA
    let buf = XLSX.write(workbook,{type:"buffer",bookType:"xlsx"});

    resolve(buf);

}

module.exports={marcas_precios}