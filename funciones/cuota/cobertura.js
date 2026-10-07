const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {cuota_existe} = require('../../querys/cuota/revisar_registro')
let {registro_cuota} = require('../../querys/cuota/registrar')
let {cuota_tiempo} = require('../../querys/cuota/mostrar')
let {cuota_avance_cobertura} = require('../../querys/cuota/cobertura')
let {cuota_avance_objetivo_especifico} = require('../../querys/cuota/objetivo_specifico')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {frase} = require('./frases')
let {avance_detalle} = require('../../querys/cuota/avance_detalle')
const {error_corrector} = require('../error/err1')

async function cuota_cobertura(req,res,next) {
    try{
        const primera_call = await consulta1(req);//galletas
        const segunda_call = await consulta2(req);//diferenciador
        const tercer_call = await obtenerpromesa_conexion();
        const cuarta_call = await consulta3(tercer_call,primera_call,segunda_call);///tiempos
        const quinta_call = await consulta4(cuarta_call);//mensaje temporal segun dias restantes
        const sexta_call = await obtenerpromesa_conexion();
        const setima_call = await consulta5(sexta_call,primera_call,segunda_call);//monto recaudado hasta el momento
        const octava_call = await consulta6(cuarta_call,setima_call,quinta_call);
        ////AUN falta calcular el porcentaje segun el objetivo especifico
        const novena_call = await consulta7(octava_call);
        const decima_call = await obtenerpromesa_conexion();
        const onceava_call = await consulta8(decima_call,primera_call,novena_call);
        const doceava_call = await consulta9(novena_call,onceava_call);

        /////los cuatro añadidos: lo que falta en dinero, el ritmo, lo que restan las
        /////notas de credito y los clientes con reposicion vencida. Si alguno falla
        /////viene en null y la pantalla se abre igual.
        const extra_conexion = await obtenerpromesa_conexion();
        const extra = await consulta10(extra_conexion, primera_call.codigo, primera_call.identificador,
                                       doceava_call["meta"], doceava_call["avance"]);
        Object.assign(doceava_call, extra);
        
        res.status(200).json({"simple":doceava_call});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req)) }

function consulta2(req){ return new Promise((resolve,reject)=>galleta_tipo(resolve,reject,req)) }

function consulta3(conexion,galleta,diferenciador){ return new Promise((resolve,reject)=>cuota_tiempo(resolve,reject,conexion,galleta,diferenciador)) }

function consulta4(tiempo){ return new Promise((resolve,reject)=>avance_mensaje(resolve,reject,tiempo)) }

function consulta5(conexion,galleta,diferenciador){ return new Promise((resolve,reject)=>cuota_avance_cobertura(resolve,reject,conexion,galleta,diferenciador)) }

function consulta6(tiempos,monto,textodia){ return new Promise((resolve,reject)=>estimacion_monto(resolve,reject,tiempos,monto,textodia)) }

function consulta7(montos){ return new Promise((resolve,reject)=>calculo_porcentaje(resolve,reject,montos)) }

function consulta8(conexion,galleta,objformato){ return new Promise((resolve,reject)=>cuota_avance_objetivo_especifico(resolve,reject,conexion,galleta,objformato)) }

function consulta9(objformato,avance){ return new Promise((resolve,reject)=>calculo_avance_objetivo_especifico(resolve,reject,objformato,avance)) }

function consulta10(conexion,codven,codusu,meta,avance){ return new Promise((resolve,reject)=>avance_detalle(resolve,reject,conexion,codven,codusu,meta,avance)) }

function calculo_avance_objetivo_especifico(resolve,reject,objformato,avance){
    ////termina de calcular el porcentaje de avance de su objetivo
    let cuota_objspec_fijada=objformato["objspec_cuota"];
    objformato["objspec_avance"]=avance;
    let objspec_avance = avance;
    let porcentaje_objspecifico= Number(((avance/cuota_objspec_fijada)*100).toFixed(2));
    objformato["objspec_porcentaje"]=porcentaje_objspecifico;
    resolve (objformato);
}

function calculo_porcentaje(resolve,reject,objformato){    
    let cuota_fijada=objformato["meta"];
    let cuota_objspecifico= Number(((cuota_fijada*objformato["objesp"])/100).toFixed(3));
    objformato["objspec_cuota"]=cuota_objspecifico;
    resolve(objformato);
}

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
        case tiempo[7]>=30:
            resolve("tienes tiempo de sobra");
            break;

        case tiempo[7]>=20:
            resolve("aun tienes mas de la mitad de mes");
            break;

        case tiempo[7]>=10:
            resolve("anda ajustando que ya no tienes ni la mitad de mes");
            break;

        case tiempo[7]>=5:
            resolve("ya estas en los ultimos dias");
            break;

        case tiempo[7]>=2:
            resolve("tik tok señor wick");
            break;

        case tiempo[7]==1:
            resolve("ahora ps llego el dia");
            break;
    
        default:
            resolve("error inesperado")
            break;
    }
}

function estimacion_monto(resolve,reject,tiempos,monto,textodia){
    let objformato={}
    /////la frase sale del catalogo de funciones/cuota/frases.js, que rota con el dia
    /////del mes para que no se repita la misma dos dias seguidos


    let cuota_fijada=tiempos[3];
    let cuota_avanse=monto;

    let porcentaje= (cuota_avanse/cuota_fijada)*100;

    let recortado = `${porcentaje.toFixed(2)} %`;

    //////////////////
    objformato["diastexto"]=textodia;
    objformato["meta"]=tiempos[3];
    /////SUM() devuelve null cuando el vendedor no facturo nada todavia este mes; la
    /////pantalla no deberia recibir un null donde espera una cifra
    objformato["avance"]=Number(monto)||0;
    objformato["porcentaje"]=recortado;
    objformato["mensaje"]=frase(porcentaje, new Date().getDate());
    objformato["codfam"]=tiempos[9];
    objformato["objesp"]=tiempos[10];

    resolve(objformato);
}



module.exports={cuota_cobertura}