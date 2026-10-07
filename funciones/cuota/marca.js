const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {cuota_existe} = require('../../querys/cuota/revisar_registro')
let {registro_cuota} = require('../../querys/cuota/registrar')
let {cuota_tiempo} = require('../../querys/cuota/mostrar')
let {cuota_marca_seleccionada_avance} = require('../../querys/cuota/mostrar_marca')
// let {cuota_avance_cartera} = require('../../querys/cuota/cartera')
let {guardar_marca_seleccionada_avance} = require('../../querys/cuota/guardar_marca_avance')
let {cuota_marca_tiempo_avance} = require('../../querys/cuota/mostrar_tiempo_marca')
let {cuota_marca_monto_estimado} = require('../../querys/cuota/mostrar_marca_montos')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function cuota_marca_dinamica(req,res,next) {
    try{
        const primera_call = await consulta1(req);//galletas
        const segunda_call = await consulta2(req);
        const tercer_call = await obtenerpromesa_conexion();
        const cuarta_call = await consulta3(tercer_call,primera_call,req.body);///avance,costo,rentabilidad
        const quinta_call = await obtenerpromesa_conexion();
        const sexta_call = await consulta4(quinta_call,req.body,cuarta_call);///actualisacion de montos
        const setima_call = await obtenerpromesa_conexion();
        const octava_call = await consulta5(setima_call);///tiempos dias restantes
        const novena_call = await obtenerpromesa_conexion();
        const decima_call = await consulta6(novena_call,req.body);///monto estimado a llegar de la marca
        const unceava_call = await consulta7(octava_call);///texto del mes
        const doceava_call = await consulta8(decima_call,octava_call,unceava_call);
        
        res.status(200).json({"estimado":doceava_call});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req)) }

function consulta2(req){ return new Promise((resolve,reject)=>galleta_tipo(resolve,reject,req)) }

function consulta3(conexion,galleta,body){ return new Promise((resolve,reject)=>cuota_marca_seleccionada_avance(resolve,reject,conexion,galleta,body)) }

function consulta4(conexion,body,avance){ return new Promise((resolve,reject)=>guardar_marca_seleccionada_avance(resolve,reject,conexion,body,avance)) }

function consulta5(conexion){ return new Promise((resolve,reject)=>cuota_marca_tiempo_avance(resolve,reject,conexion)) }

function consulta6(conexion,body){ return new Promise((resolve,reject)=>cuota_marca_monto_estimado(resolve,reject,conexion,body)) }

function consulta7(tiempos){ return new Promise((resolve,reject)=>avance_mensaje(resolve,reject,tiempos)) }

function consulta8(monto,tiempos,textodia){ return new Promise((resolve,reject)=>estimacion_monto(resolve,reject,monto,tiempos,textodia)) }

function galleta_credencial(resolve,reject,req){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}

function galleta_tipo(resolve,reject,req){
    /////esta galleta solo esta firmada no esta en un jws
    let tipo=req.signedCookies.tip;
    if(typeof tipo ==='string'){
        resolve(tipo)
    }
    else{reject("falsa galleta")}
}

function avance_mensaje(resolve,reject,tiempo){
    ////aqui es donde le decimos en texto un mensaje referente al avance
    switch (true) {
        case tiempo[0]>=30:
            resolve("tienes tiempo de sobra");
            break;

        case tiempo[0]>=20:
            resolve("aun tienes mas de la mitad de mes");
            break;

        case tiempo[0]>=10:
            resolve("anda ajustando que ya no tienes ni la mitad de mes");
            break;

        case tiempo[0]>=5:
            resolve("ya estas en los ultimos dias");
            break;

        case tiempo[0]>=2:
            resolve("tik tok señor wick");
            break;
    
        default:
            resolve("error inesperado")
            break;
    }
}
//////manejar de manera diferente porqe los montos son diferentes

function estimacion_monto(resolve,reject,monto,tiempos,textodia){
    // recuerda que este monto es [avance,costo,rentabilidad]
    let objformato={}
    let mensaje="";

    let cuota_fijada=monto[0];
    let cuota_avanse=monto[1];

    let porcentaje= (cuota_avanse/cuota_fijada)*100;

    let recortado = `${porcentaje.toFixed(2)} %`;

    switch (true) {
        case porcentaje<=5:
            mensaje="que asi se chambea?";
            break;

        case porcentaje<=10:
            mensaje="comensando a calentar";
            break;

        case porcentaje<=20:
            mensaje="ya terminaste de vender a los clientes seguros del mes";
            break;

        case porcentaje<=30:
            mensaje="ya tienes un tercio";
            break;

        case porcentaje<=40:
            mensaje="ponte la camiseta tio";
            break;

        case porcentaje<=50:
            mensaje="WEEEEENA mitad desbloqueado";
            break;

        case porcentaje<=60:
            mensaje="no esperes que te pasen pedidos, buscalos";
            break;

        case porcentaje<=70:
            mensaje="buen monto pero no para comisionar";
            break;

        case porcentaje<=80:
            mensaje="un poco mas de esfuerso y llegamos al minimo para comisionar";
            break;

        case porcentaje<=90:
            mensaje="apurate goku, ya casi llegas a tu destino";
            break;

        case porcentaje<=100:
            mensaje="la PIZZA ya esta en camino apurate";
            break;

        case porcentaje>100:
            mensaje="TU SI ERES VENDEDOR NO COMO EL DE TU COSTADO";
            break;
    
        default:
            mensaje="error de mensajeria";
            break;
    }
    //////////////////
    objformato["diastexto"]=textodia;
    objformato["meta"]=monto[0];
    objformato["avance"]=monto[1];    
    objformato["porcentaje"]=recortado;
    objformato["mensaje"]=mensaje;
    objformato["costo"]=monto[2];
    objformato["rentabilidad"]=monto[3];

    resolve(objformato);
}



module.exports={cuota_marca_dinamica}