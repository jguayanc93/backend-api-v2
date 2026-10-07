
const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {prom_cabeza_seccion1} = require('../../querys/promocion/promheader_simple1')
let {prom_detallado_seccion2} = require('../../querys/promocion/promdetail_simple2')
///////ESPACIO PARA FUNCIONES GENERALES
const motor = require('./motor')
const {desdeCarrito} = require('./normalizar')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////simula que promocion le corresponde al carrito que el frontend tiene en pantalla.
/////no escribe nada: solo calcula y devuelve.
async function prom_temporal_mejorada(req,res,next) {
    try{
        const carrito = await consulta1(req.body);
        const conexion_cabecera = await obtenerpromesa_conexion();
        const cabecera_promo = await consulta2(conexion_cabecera,req.body);

        /////un solo punto de clasificacion, en vez de nuevo_separador_tipos + que_venta
        const promo = motor.clasificar(cabecera_promo);

        const conexion_detalle = await obtenerpromesa_conexion();
        const detalle_promo = await consulta6(conexion_detalle,req.body.codigo);

        const resultado = motor.evaluar({
            promo,
            origen:'carrito',
            codigos: carrito.codigos,
            cotdetalle: carrito.lineas,
            promcabesa: cabecera_promo,
            promdetalle: detalle_promo,
            /////los evaluadores siguen leyendo tipopromo["metrica"] / ["descuento"] / ["idprom"]
            tipopromo: promo
        });

        if(!motor.hayResultado(resultado)){
            /////no es un error: la promo simplemente no aplica. Se devuelve el motivo
            /////para que el modal diga si falta cantidad o si el producto no participa.
            const detalle=motor.motivoNoAplica(resultado);
            return res.status(200).json({"status":"no aplica","codigo":0,"data":null,
                                         "motivo":detalle.motivo,"faltante":detalle.faltante,
                                         "unidad":detalle.unidad,"msg":detalle.mensaje});
        }

        res.status(200).json({"status":"ok","codigo":0,"data":resultado});
    }
    catch(err){ error_corrector(res,err); }
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }

function consulta1(body){ return new Promise((resolve)=>resolve(desdeCarrito(body.productos))) }

function consulta2(conexion,body){ return new Promise((resolve,reject)=>prom_cabeza_seccion1(resolve,reject,conexion,body)) }

function consulta6(conexion,codigo){ return new Promise((resolve,reject)=>prom_detallado_seccion2(resolve,reject,conexion,codigo)) }

module.exports={prom_temporal_mejorada}
