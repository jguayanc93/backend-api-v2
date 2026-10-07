const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {coti_detallado} = require('../../querys/promocion/prom_buscar_cabecera')
let {promocion_id} = require('../../querys/promocion/promocion_id')
let {prom_buscar_detallado} = require('../../querys/promocion/prom_buscar_detallado')
///////ESPACIO PARA FUNCIONES GENERALES
const motor = require('./motor')
const {desdeDetalleBD} = require('./normalizar')
let descuento = require('./descuento')
let bonificacion = require('./bonificacion')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')
const {haciaRespuesta} = require('./destino')

/////aplica la promocion sobre el detalle ya guardado de la cotizacion.
/////la sesion la valida el middleware del router, no cada handler.
async function prom_adjuntar(req,res,next) {
    try{
        const conexion_detalle = await obtenerpromesa_conexion();
        const detalle_coti = await consulta1(conexion_detalle,req.body);

        const conexion_cabecera = await obtenerpromesa_conexion();
        const cabecera_promo = await consulta2(conexion_cabecera,req.body);

        /////un solo punto de clasificacion, en vez de buscar_tipo + buscar_metrica + buscar_grupo
        const promo = motor.clasificar(cabecera_promo);
        /////se normaliza para tener los codigos y los totales sin indices magicos
        const cotizacion = desdeDetalleBD(detalle_coti);

        const conexion_promdet = await obtenerpromesa_conexion();
        const detalle_promo = await consulta6(conexion_promdet,req.body);

        const resultado = motor.evaluar({
            promo,
            origen:'bd',
            nprom: req.body.nprom,
            cotdetalle: detalle_coti,
            promcabesa: cabecera_promo,
            promdetalle: detalle_promo,
            /////los evaluadores de este lado leen tipopromo[0] y tipometrica sueltos
            tipopromo: [promo.venta, promo.descuento, promo.otorga],
            tipometrica: promo.metrica
        });

        if(!motor.hayResultado(resultado)){
            return error_corrector(res,"no promo aplicable");
        }

        /////el eje beneficio decide el paso siguiente: descontar o regalar
        /////en /mostrar el destino es la respuesta HTTP; en /acoplar es la insercion
        const destino = haciaRespuesta(res, error_corrector);

        if(motor.esDescuento(promo)){
            descuento(destino,req.body.nprom,detalle_coti,cabecera_promo,detalle_promo,
                      [promo.venta,promo.descuento,promo.otorga],promo.metrica,resultado,promo);
        }
        else{
            const conexion_bonificacion = await obtenerpromesa_conexion();
            bonificacion(destino,req.body.nprom,detalle_coti,cabecera_promo,detalle_promo,
                         [promo.venta,promo.descuento,promo.otorga],promo.metrica,resultado,conexion_bonificacion,promo);
        }
    }
    catch(err){ error_corrector(res,err); }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(conexion,body){ return new Promise((resolve,reject)=>coti_detallado(resolve,reject,conexion,body)) }

function consulta2(conexion,body){ return new Promise((resolve,reject)=>promocion_id(resolve,reject,conexion,body)) }

function consulta6(conexion,body){ return new Promise((resolve,reject)=>prom_buscar_detallado(resolve,reject,conexion,body)) }

module.exports={prom_adjuntar}
