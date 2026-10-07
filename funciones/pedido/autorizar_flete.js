const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {activar_flete} = require('../../querys/pedido/autorizar_flete')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Aplica el flete de provincia a un pedido. Cuerpo: {"npedi":"099-00132184"}.
/////
/////Ya no se reciben flag ni apro: venian del propio navegador y el servidor los tiene en
/////la base. Quien decide si corresponde flete es el trigger del ERP, no la pantalla.
async function autorizar_flete(req,res,next) {
    try{
        const payload = leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");

        const conexion = await obtenerpromesa_conexion();
        const hecho = await consulta1(conexion,payload,req.body);

        res.status(200).json({
            "status":"ok", "codigo":0,
            "documento":hecho.documento,
            "totales":hecho.totales
        });
    }
    catch(err){
        /////el minimo no alcanzado se responde con las cifras, para que la pantalla pueda
        /////decir cuanto falta en vez de solo que no se puede
        if(err && err.clave === "flete monto insuficiente"){
            return res.status(409).json({
                "status": err.clave, "codigo": 3,
                "msg": "el pedido no alcanza el monto minimo para el flete de provincia",
                "moneda": err.moneda, "total": err.total,
                "minimo": err.minimo, "falta": err.falta
            });
        }
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(conexion,galleta,cuerpo){
    return new Promise((resolve,reject)=>activar_flete(resolve,reject,conexion,galleta,cuerpo))
}

module.exports={autorizar_flete}
