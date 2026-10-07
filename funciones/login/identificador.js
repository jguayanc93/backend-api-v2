const {leerGalleta} = require('../comunes/auth')
require('dotenv').config();
// const cookieParser = require('cookie-parser')
// const {Request,TYPES} = require('../../conexion/cadena')
const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {identificador_logeo} = require('../../querys/login/identificador');
//////espacio para la implementacion del token
// let {jwtgenerator} = require('../../login/token')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

async function usuario_autenticador(req,res,next) {
    try{
        ////lo que necesito estan en las cookies firmadas pero solo pueden usarse en produccion no en desarrollo
        ////dividir las consultas para conocer al vendedor y su area y sus diferencias para crear otra galleta
        ////para dar ciertos permisos y caracteristicas especiales y poder dividirlos
        const primera_call= await consulta1(req,next);
        const segunda_call= await obtenerpromesa_conexion();
        const tercera_call= await consulta2(primera_call,segunda_call);

        res.cookie('tip',tercera_call,{
            domain:'compudiskett.com.pe',
            path:'/',
            httpOnly:true,
            maxAge:1000 * 60 * 60 * 24,   ////igual que cdk: /vendedor necesita las dos, y con 1h el vendedor quedaba fuera cada hora aunque su sesion siguiera viva
            sameSite:'None',
            secure:true,
            signed:true
        })

        res.status(200).json(JSON.stringify({"correcto":tercera_call}));
    }
    catch(err){        
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(req,next){
    return new Promise((resolve,reject)=>galleta_credencial(resolve,reject,req,next))
}

function consulta2(payload,conexion){
    return new Promise((resolve,reject)=>identificador_logeo(resolve,reject,payload,conexion))
}

function galleta_credencial(resolve,reject,req,next){
    /////el secreto vive en funciones/comunes/auth.js y sale de JWT_SECRET;
    /////antes estaba escrito a mano en cada copia de esta funcion
    const payload = leerGalleta(req);
    if(payload) resolve(payload);
    else reject("falsa galleta");
}

module.exports={usuario_autenticador}