const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {vendedormes_top} = require('../../querys/vendedormes/top')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Vendedor del mes del grupo 25. Contrato: docs/vendedor-mes-grupo25.md
async function top_vendedormes(req,res,next){
    try{
        const payload = req.usuario || leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");
        const conexion = await obtenerpromesa_conexion();
        const resultado = await new Promise((resolve,reject)=>vendedormes_top(resolve,reject,conexion,payload,Object.assign({},req.query,req.body)));
        res.status(200).json({"status":"ok","codigo":0,"data":resultado});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

module.exports={top_vendedormes}
