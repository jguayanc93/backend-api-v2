const {conn} = require('../../conexion/cnn')
let {tipo_cambio} = require('../../querys/cotizacion/tipcambio');
///////ESPACIO PARA FUNCIONES GENERALES
let modulos = require('../modulos')
const {leerGalleta} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Devuelve los modulos a los que el grupo del usuario tiene acceso, mas los datos de
/////usuario que la pantalla necesita para pintarse.
/////
/////Antes solo salia el mapa de modulos, doble codificado, asi que el frontend no recibia
/////nombre, grupo ni tipo de cambio y caia siempre a su version generica.
async function grupos_modulos(req,res,next) {
    try{
        const payload = leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");

        const permisos = modulos[`grupo${payload.id_grupo}`];
        /////el usuario si esta registrado: lo que falta es el mapa de modulos de su grupo
        /////en funciones/modulos.js. Hoy solo estan el 20, 25 y 34.
        if(!permisos){
            console.error("[vendedor] grupo sin modulos definidos:",payload.id_grupo,payload.nom_grupo);
            return error_corrector(res,"grupo sin modulos");
        }

        /////el tipo de cambio del dia: el frontend tenia uno fijo escrito a mano
        const cambio = await tipoCambioDelDia();

        res.status(200).json({
            "status":"ok", "codigo":0,
            "data": permisos,
            "nombre": payload.nombre,
            "grupo": payload.nom_grupo,
            "tipo": req.signedCookies ? req.signedCookies.tip : null,
            "tipoCambio": cambio
        });
    }
    catch(err){
        error_corrector(res,err);
    }
}

/////Si no hay tipo de cambio cargado para hoy se devuelve null en vez de fallar:
/////la pantalla tiene que poder abrirse igual.
function tipoCambioDelDia(){
    return new Promise((resolve)=>{
        conn(
            (conexion)=>tipo_cambio(
                (fila)=>resolve(fila && fila[0] != null ? Number(fila[0]) : null),
                ()=>resolve(null),
                conexion),
            ()=>resolve(null)
        );
    });
}

module.exports={grupos_modulos}
