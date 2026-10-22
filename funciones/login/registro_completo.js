const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();
// const cookieParser = require('cookie-parser')
// const {Request,TYPES} = require('../../conexion/cadena')
const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
/////el registro y las marcas del grupo 25 van juntos en una transaccion dentro de logeo_registro;
/////antes las marcas se guardaban aparte en tbl01api_vendedores_marcas
let {logeo_registro} = require('../../querys/login/registro');
//////espacio para la implementacion del token
// let {jwtgenerator} = require('../../login/token')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function usuario_registrado(req,res,next) {
    try{
        ////lo que necesito estan en las cookies firmadas pero solo pueden usarse en produccion no en desarrollo
        const primera_call= await consulta1(req,next);
        const segunda_call= await obtenerpromesa_conexion();
        const tercera_call= await consulta2(primera_call,segunda_call,req);

        res.cookie('tip',tercera_call.tipo,{
            domain:'compudiskett.com.pe',
            path:'/',
            httpOnly:true,
            maxAge:1000 * 60 * 60 * 24,   ////igual que cdk: /vendedor necesita las dos, y con 1h el vendedor quedaba fuera cada hora aunque su sesion siguiera viva
            sameSite:'None',
            secure:true,
            signed:true
        })

        /////Antes se redirigia a /v1/login/identificador, que solo devuelve el tipo. Ahora la
        /////respuesta tambien tiene que decir que marcas se asignaron y cuales se saltaron, asi
        /////que se responde aqui mismo, con la misma forma que identificador ("correcto") para
        /////que la pantalla siga leyendo el tipo donde lo leia.
        /////marcas y confirmado solo vienen en el grupo 25 (ver logeo_registro)
        res.status(200).json(JSON.stringify(Object.assign({"correcto":tercera_call.tipo},
            tercera_call.marcas ? {"marcas":tercera_call.marcas,"confirmado":tercera_call.confirmado} : {})));
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req,next){
    return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req,next))
}

function consulta2(payload,conexion,req){
    return new Promise((resolve,reject)=>logeo_registro(resolve,reject,payload,conexion,req))
}

function galleta_credencial(resolve,reject,req,next){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}

module.exports={usuario_registrado}
