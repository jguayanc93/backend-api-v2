require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
// let {promo_vertodo} = require('../../querys/promocion/cotizacion')
// let {promo_buscador} = require('../../querys/promocion/buscador')
let {promocion_id} = require('../../querys/promocion/promocion_id')
let {coti_contiene_promocion} = require('../../querys/promocion/promocion_en_cotizacion')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function prom_analisar(req,res,next) {
    try{
        const segunda_call = await obtenerpromesa_conexion();
        const tercera_call = await consulta2(segunda_call,req.body);
        const cuarta_call = await obtenerpromesa_conexion();
        const quinta_call = await consulta3(cuarta_call,req.body,tercera_call);
        if(quinta_call==='next'){
            next();
        }
        else{ res.status(200).json({"status":"promo ya aplicada","codigo":0,"msg":"la promocion ya esta aplicada en esta cotizacion"}); }
        // res.status(200).json(quinta_call);
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }


function consulta2(conexion,cuerpo){ return new Promise((resolve,reject)=>promocion_id(resolve,reject,conexion,cuerpo)) }

function consulta3(conexion,cuerpo,promocion){ return new Promise((resolve,reject)=>coti_contiene_promocion(resolve,reject,conexion,cuerpo,promocion)) }




module.exports={prom_analisar}