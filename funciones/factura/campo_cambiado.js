const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {factura_campo_update, CAMPOS} = require('../../querys/factura/campo_modificado')
///////ESPACIO PARA FUNCIONES GENERALES
const {leerGalleta, tienePermiso} = require('../comunes/auth')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Aplica el cambio de un campo de factura.
/////
/////Cuerpo de siempre, con la clave numerica del campo:   { "1": "4", "doc": "F009-..." }
/////o, mas legible, con el nombre:                        { "campo": "despacho", "valor": "4", "doc": "F009-..." }
/////
/////Las dos formas conviven. La numerica se buscaba antes como "la primera clave del
/////objeto", asi que mandar doc primero respondia "no match"; ahora se busca entre todas.
async function facturaxcampoxcambiado(req,res,next) {
    try{
        const payload = leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");

        const elegido = identificarCampo(req.body);
        if(!elegido) return error_corrector(res,"campo desconocido");

        /////el permiso depende del campo, que viene en el cuerpo: por eso se comprueba
        /////aqui y no con un middleware fijo en el router
        if(!tienePermiso(payload,'factura',CAMPOS[elegido.clave].permiso)){
            return error_corrector(res,"sin permiso");
        }

        const conexion = await obtenerpromesa_conexion();
        const hecho = await consulta1(conexion,payload,elegido.clave,
                                      {doc:req.body.doc, nuevo:elegido.valor});

        res.status(200).json({
            "status":"ok", "codigo":0,
            "documento":hecho.documento,
            "campo":hecho.campo,
            "valor":hecho.valor
        });
    }
    catch(err){
        error_corrector(res,err);
    }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(conexion,galleta,clave,valor){
    return new Promise((resolve,reject)=>factura_campo_update(resolve,reject,conexion,galleta,clave,valor))
}

/////Por nombre si viene, y si no por la clave numerica, mirandolas todas y no solo la
/////primera del objeto.
const PORNOMBRE = {};
Object.keys(CAMPOS).forEach(k=>{ PORNOMBRE[CAMPOS[k].permiso] = k; });

function identificarCampo(body){
    if(!body) return null;

    if(body.campo !== undefined){
        const clave = PORNOMBRE[String(body.campo).trim()];
        return clave ? {clave:clave, valor:body.valor} : null;
    }

    const clave = Object.keys(body).find(k=>CAMPOS[k] !== undefined);
    return clave ? {clave:clave, valor:body[clave]} : null;
}

module.exports={facturaxcampoxcambiado}
