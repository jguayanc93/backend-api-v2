require('dotenv').config();

const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {promo_vertodo} = require('../../querys/promocion/cotizacion')
let {promo_buscador} = require('../../querys/promocion/buscador')
let {promo_buscador_simple} = require('../../querys/promocion/buscador_part1')
///////ESPACIO PARA FUNCIONES GENERALES

////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function prom_buscar_paso1(req,res,next) {
    try{
        const cuarta_call = await obtenerpromesa_conexion();
        const quinta_call = await consulta3(cuarta_call,req.body);
        const sexta_call = await consulta4(quinta_call);
        
        res.status(200).json({"status":"ok","codigo":0,"data":sexta_call});
        // res.status(200).json(req.body.productos);
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }


// function consulta2(conexion,cuerpo){ return new Promise((resolve,reject)=>promo_vertodo(resolve,reject,conexion,cuerpo)) }

function consulta3(conexion,detallado){ return new Promise((resolve,reject)=>promo_buscador_simple(resolve,reject,conexion,detallado)) }

function consulta4(agrupados){ return new Promise((resolve,reject)=>promocion_agrupados(resolve,reject,agrupados)) }

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




module.exports={prom_buscar_paso1}