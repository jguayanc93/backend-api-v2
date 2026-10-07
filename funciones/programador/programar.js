const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {despacho_de_hoy} = require('../../querys/programador/despacharhoy')
let {programar_factura_data} = require('../../querys/programador/factura_data')
let {programar_factura_data_completa} = require('../../querys/programador/factura_data_completa')
let {programar_items_zona} = require('../../querys/programador/factura_zona')
let {programar_revisar_entrega} = require('../../querys/programador/revisar_factura_entregado')
let {programar_factura_almacen} = require('../../querys/programador/factura_programado_almacen')
let {programador_refrescar_lista} = require('../../querys/programador/refrescar_programador')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function programarfactura(req,res,next) {
    try{
        const primera_call = await consulta1(req,next);//galletas
        const segunda_call = await obtenerpromesa_conexion();
        const tercera_call = await consulta2(segunda_call,req.body);///factura data general
        const cuarta_call = await obtenerpromesa_conexion();
        const quinta_call = await consulta3(cuarta_call,tercera_call);///factura data completa
        const sexta_call = await obtenerpromesa_conexion();
        const setima_call = await consulta4(sexta_call,quinta_call);//ver zonas de los items
        const octava_call = await obtenerpromesa_conexion();
        const novena_call = await consulta5(octava_call,quinta_call,setima_call);///revisar esta de entrega
        const decima_call = await obtenerpromesa_conexion();
        const onceava_call = await consulta6(decima_call,quinta_call,setima_call);///programado en almacen
        ////aqui lo mando a revisar de nuevo la lista recargada de documentos a despachar
        const doceva_call = await obtenerpromesa_conexion()
        const treceava_call = await consulta7(doceva_call,primera_call);///refrescar el programador

        
        res.status(200).json(JSON.stringify(treceava_call));
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req,next){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req,next)) }

function consulta2(conexion,body){ return new Promise((resolve,reject)=>programar_factura_data(resolve,reject,conexion,body)) }

function consulta3(conexion,factura_data){ return new Promise((resolve,reject)=>programar_factura_data_completa(resolve,reject,conexion,factura_data)) }

function consulta4(conexion,factura_data){ return new Promise((resolve,reject)=>programar_items_zona(resolve,reject,conexion,factura_data)) }

function consulta5(conexion,factura_data,zonas){ return new Promise((resolve,reject)=>programar_revisar_entrega(resolve,reject,conexion,factura_data,zonas)) }

function consulta6(conexion,factura_data,zonas){ return new Promise((resolve,reject)=>programar_factura_almacen(resolve,reject,conexion,factura_data,zonas)) }

function consulta7(conexion,galleta){ return new Promise((resolve,reject)=>programador_refrescar_lista(resolve,reject,conexion,galleta)) }

function galleta_credencial(resolve,reject,req,next){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}



module.exports={programarfactura}