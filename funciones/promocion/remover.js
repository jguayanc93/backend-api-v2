const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {remover_promociones} = require('../../querys/promocion/remover_transaccion')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')
const {normalizarNdocu} = require('../comunes/constantes')

/////Quita una o varias promociones de una cotizacion ya creada, dejando intactas las
/////demas. Todo el trabajo (validar, borrar lineas, retirar flete y recalcular la
/////cabecera) va en UNA transaccion: antes eran 3 conexiones sueltas y un fallo a
/////mitad dejaba la cotizacion descuadrada.
async function prom_remover(req,res,next) {
    try{
        const {documento, items} = extraer(req.body);

        const conexion = await obtenerpromesa_conexion();
        const resultado = await quitar(conexion, req.usuario, documento, items);

        res.status(200).json({"status":"ok","codigo":0,"msg":"removido con exito",
                              "documento":resultado.documento,"removidas":resultado.removidas});
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function quitar(conexion,galleta,documento,items){
    return new Promise((resolve,reject)=>remover_promociones(resolve,reject,conexion,galleta,documento,items))
}

/////body.removeproms es una lista de pares [ndocu, item].
/////Se exige que todas las filas sean del mismo documento para que una sola llamada
/////no pueda mezclar el borrado de dos cotizaciones.
function extraer(body){
    const filas = body ? body.removeproms : null;
    if(!Array.isArray(filas) || filas.length===0) throw "cotizacion no registrada";

    /////el ndocu tiene que venir con su serie. Si llega el numero suelto (970435)
    /////no se puede saber si es de la serie 009- o 098-, asi que se rechaza.
    const crudo = filas[0][0];
    if(filas.some(f => f[0] !== crudo)) throw "cotizacion no registrada";

    const documento = normalizarNdocu(crudo);
    if(documento === null) throw "documento ambiguo";

    const items = [];
    for(const f of filas){
        const item = parseInt(f[1]);
        if(!Number.isInteger(item)) throw "cotizacion no registrada";
        if(!items.includes(item)) items.push(item);
    }
    return {documento, items};
}

module.exports={prom_remover}
