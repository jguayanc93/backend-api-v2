/////Verificacion de sesion en un solo lugar.
/////Antes esta misma funcion estaba copiada en 72 archivos, cada una con el
/////secreto escrito a mano, y algunos handlers simplemente se olvidaban de llamarla.
const jws = require('jws');
const permisos = require('../permisos');
const {error_corrector} = require('../error/err1');

const SECRETO = process.env.JWT_SECRET || 'chistemas';

/////lee y valida la cookie firmada. Devuelve el payload o null.
function leerGalleta(req){
    const token = req.signedCookies ? req.signedCookies.cdk : null;
    /////jws.verify revienta con TypeError si el token es undefined, por eso se corta antes
    if(typeof token !== 'string' || token.length === 0) return null;

    try{
        if(!jws.verify(token,'HS256',SECRETO)) return null;
        const decodificado = jws.decode(token);
        return decodificado ? decodificado.payload : null;
    }catch(e){
        return null;
    }
}

/////middleware: exige sesion valida y deja el usuario en req.usuario
function exigirSesion(req,res,next){
    const payload = leerGalleta(req);
    if(!payload) return error_corrector(res,"falsa galleta");
    req.usuario = payload;
    next();
}

/////¿el grupo de este usuario tiene el permiso? Es la misma regla que aplica
/////exigirPermiso, aparte para poder consultarla sin cortar la peticion: hay rutas que
/////deciden el campo por el cuerpo, y pantallas que necesitan saber que pueden pintar.
function tienePermiso(payload,modulo,accion){
    if(!payload) return false;
    const delModulo = permisos[modulo];
    const permitidos = delModulo ? delModulo[accion] : null;
    /////una lista vacia en la matriz significa "todavia sin restringir"
    if(!permitidos || permitidos.length === 0) return true;
    return permitidos.includes(parseInt(payload.id_grupo));
}

/////middleware: exige que el grupo del usuario tenga el permiso pedido.
/////la matriz de funciones/permisos.js ya existia pero solo se leia en el GET /
function exigirPermiso(modulo,accion){
    return function(req,res,next){
        const payload = req.usuario || leerGalleta(req);
        if(!payload) return error_corrector(res,"falsa galleta");
        req.usuario = payload;

        if(tienePermiso(payload,modulo,accion)) return next();
        return error_corrector(res,"sin permiso");
    };
}

module.exports={leerGalleta,exigirSesion,exigirPermiso,tienePermiso,SECRETO};
