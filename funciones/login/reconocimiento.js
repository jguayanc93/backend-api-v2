require('dotenv').config();

const {Request,TYPES} = require('../../conexion/cadena')
const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {comprobacion_logeo} = require('../../querys/login/reconocimiento');
//////espacio para la implementacion del token
let {jwtgenerator} = require('../../login/token')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')
/////quien entro, cuando y desde que dispositivo
const {registrarSesion} = require('../comunes/auditoria')

async function logeo(req,res,next) {
    try{
        const primera_call= await obtenerpromesa_conexion();
        const segunda_call= await consulta1(primera_call,req,next);
        const tercera_call= await consulta2(segunda_call);

        res.cookie('cdk',tercera_call,{
            domain:'compudiskett.com.pe',
            path:'/',
            httpOnly:true,
            maxAge:1000 * 60 * 60 * 24,
            sameSite:'None',
            secure:true,
            signed:true
        })
        /////la fila del procedimiento viene por posicion, no con la forma del token
        registrarSesion(req,"entrada",{usuario:{identificador:segunda_call[0], nombre:segunda_call[1],
                                                codigo:segunda_call[2], id_grupo:segunda_call[5]}});
        res.redirect('/v1/login/identificador');
        // res.redirect('identificador');////resolver esto despues
        // res.status(200).json(JSON.stringify(segunda_call));
    }
    catch(err){
        registrarSesion(req,"rechazo",{motivo: typeof err==="string" ? err : "error"});
        error_corrector(res,err);
        /////el error debes manejarlo con una funcion especial para diferenciar las trabas
        // res.status(400).json({
        //     "status":"ERROR",
        //     "codigo":2,
        //     "msg":err
        // })        
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(conexion,req,next){
    return new Promise((resolve,reject)=>comprobacion_logeo(resolve,reject,conexion,req,next))
}
/////supongo que hara otra cosa en lugar de ejecutar query
function consulta2(usuario){
    return new Promise((resolve,reject)=>identificacion_logeo(resolve,reject,usuario))
}
///////esto deberia generar sus tokens nuevos
function identificacion_logeo(resolve,reject,usuario){
    // console.log(usuario);
    // let user_campos=Object.values(usuario);
    let autenticado=jwtgenerator(usuario);
    
    resolve(autenticado);
}

module.exports={logeo}