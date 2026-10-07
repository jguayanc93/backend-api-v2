const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {cuota_marca_existe} = require('../../querys/cuota/revisar_registro_marca')
let {promo_vertodo} = require('../../querys/promocion/cotizacion')
let {promo_buscador} = require('../../querys/promocion/buscador')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function cuota_multiple(req,res,next) {
    try{
        const primera_call = await consulta1(req);//galletas
        const segunda_call = await obtenerpromesa_conexion();
        const tercera_call = await consulta2(segunda_call,primera_call);
        const cuarta_call = await consulta3(tercera_call);

        // const cuarta_call = await obtenerpromesa_conexion();
        // const quinta_call = await consulta3(cuarta_call,tercera_call);
        
        /////`data` es el mismo objeto que la clave vieja. Cada ruta de cuota lo devolvia
        /////bajo un nombre distinto -simple, multiple, estimado- y en /cuota/simple la
        /////clave "simple" ademas guarda un texto, no un objeto: la pantalla no podia
        /////saber donde mirar. `data` es el mismo sitio en todas. La clave anterior se
        /////mantiene para no romper lo que ya la lee.
        res.status(200).json({"status":"ok","codigo":0,"data":cuarta_call,"multiple":cuarta_call});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req){ return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req)) }

function consulta2(conexion,galleta){ return new Promise((resolve,reject)=>cuota_marca_existe(resolve,reject,conexion,galleta)) }

function consulta3(vendedor){ return new Promise((resolve,reject)=>manejador_marcas(resolve,reject,vendedor)) }

function manejador_marcas(resolve,reject,vendedor){

    let ordenado={}
    ordenado["nombre"]=vendedor[0];
    ordenado["tipo"]=vendedor[1];
    let marcas={}

    let parseado=JSON.parse(vendedor[2]);

    for(const marc in parseado){
        marcas[parseado[marc][0]]=[parseado[marc][1],parseado[marc][2]];
    }

    ordenado["marcas"]=marcas;

    resolve(ordenado);
}

function promocion_agrupados(resolve,reject,respuesta){
    // console.log("OBSERVA LOS IDPROM SIN FILTRAR")
    let nuevoobj={};
    let filtro_final=[];
    let nueva_programacion=respuesta.forEach((programacion)=>{
        if(Object.hasOwn(nuevoobj,programacion[1])){
            nuevoobj[programacion[1]]+="/"+programacion[0];
        }
        else{ nuevoobj[programacion[1]]=String(programacion[0])}
    })
    // console.log("OBSERVA LOS IDPROM FILTRADOS")
    // console.log(nuevoobj);
    Object.values(nuevoobj).forEach((valor)=>{
        let separador=valor.split('/');
        for(let idprom of separador){
            if(filtro_final.includes(idprom)){}
            else{
                filtro_final.push(idprom)
            }
        }
    })

    resolve(filtro_final)
}

function galleta_credencial(resolve,reject,req){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}



module.exports={cuota_multiple}