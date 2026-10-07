/////Punto unico de decision de una promocion.
/////Antes esto estaba repartido en que_venta(), direccionador(), buscar_tipo() y
/////direccionador2(), duplicado en analisar.js y simulacion_prom.js, y las
/////combinaciones no implementadas devolvian undefined en silencio.
const {PROM, AMBITO, METRICA, BENEFICIO} = require('../comunes/constantes');

const por_item = require('./porItem');
const por_total_venta = require('./porTotalVenta');
const x_items = require('./xitems');
const x_totalisados = require('./xtotalisados');

/////traduce la fila de mst_promocion a un objeto con nombres
function clasificar(fila){
    return {
        idprom:      fila[PROM.IDPROM],
        nombre:      fila[PROM.NOMBRE],
        descripcion: fila[PROM.DESCRIPCION],
        venta:       Number(fila[PROM.VENTA]),
        descuento:   Number(fila[PROM.DESCUENTO]),
        otorga:      Number(fila[PROM.OTORGA]),
        metrica:     Number(fila[PROM.METRICA]),
        agrupado:    fila[PROM.AGRUPADO]
    };
}

/////Los ejes se canonicalizan con la misma regla que usaba el codigo original
/////(==1 y si no, el otro). En mst_promocion porvta tiene filas con 2 y metrica
/////vale 1 o 2, asi que una tabla de claves exactas dejaria casos fuera.
function ambitoDe(promo){
    return promo.venta === AMBITO.POR_ITEM ? AMBITO.POR_ITEM : AMBITO.POR_TOTAL_VENTA;
}
function metricaDe(promo){
    return promo.metrica === METRICA.VALORIZADO ? METRICA.VALORIZADO : METRICA.UNIDADES;
}
function clave(promo){ return ambitoDe(promo) + '-' + metricaDe(promo); }

/////tabla explicita sobre los ejes ya canonicalizados.
/////Lo que no esta implementado se declara, no se silencia.
const EVALUADORES = {
    /////origen 'carrito': lo que manda el frontend en /detalle (simulacion)
    carrito: {
        [AMBITO.POR_ITEM + '-' + METRICA.UNIDADES]:          por_item,
        [AMBITO.POR_TOTAL_VENTA + '-' + METRICA.UNIDADES]:   por_total_venta,
        [AMBITO.POR_TOTAL_VENTA + '-' + METRICA.VALORIZADO]: por_total_venta,
        /////COMBINACION 1 y 3: implementado en porItem.js (vx_valorizado)
        [AMBITO.POR_ITEM + '-' + METRICA.VALORIZADO]:       por_item
    },
    /////origen 'bd': el detalle guardado en dtl01cot que usa /mostrar (aplicacion real)
    bd: {
        [AMBITO.POR_ITEM + '-' + METRICA.UNIDADES]:          x_items,
        [AMBITO.POR_TOTAL_VENTA + '-' + METRICA.UNIDADES]:   x_totalisados,
        [AMBITO.POR_TOTAL_VENTA + '-' + METRICA.VALORIZADO]: x_totalisados,
        /////COMBINACION 1 y 3 del lado BD: implementado en xitems.js (metrica valorizado)
        [AMBITO.POR_ITEM + '-' + METRICA.VALORIZADO]:       x_items
    }
};

function soportada(promo, origen){
    const tabla = EVALUADORES[origen];
    if(!tabla) return false;
    return Boolean(tabla[clave(promo)]);
}

/////evalua una promocion contra la cotizacion y devuelve los items que la cumplen.
/////lanza (string) cuando la combinacion no esta implementada, para que error_corrector
/////responda algo entendible en vez de un 500 generico por leer .length de undefined.
function evaluar(opciones){
    const {promo, origen, codigos, cotdetalle, promcabesa, promdetalle, tipopromo, tipometrica, nprom} = opciones;

    const tabla = EVALUADORES[origen];
    if(!tabla) throw 'origen de promocion desconocido';

    const evaluador = tabla[clave(promo)];
    if(!evaluador){
        console.warn('[promocion] combinacion no implementada idprom=' + promo.idprom +
                     ' venta=' + promo.venta + ' metrica=' + promo.metrica + ' origen=' + origen);
        throw 'promocion no soportada';
    }

    /////cada evaluador conserva su firma original: la aritmetica de montos no se toca
    const resultado = origen === 'carrito'
        ? evaluador(codigos, cotdetalle, tipopromo, promcabesa, promdetalle)
        : evaluador(nprom, cotdetalle, promcabesa, promdetalle, tipopromo, tipometrica);

    if(resultado === undefined || resultado === null) throw 'promocion no soportada';
    return resultado;
}

/////el resultado puede venir como objeto, arreglo, o el string de "no alcanza"
function hayResultado(resultado){
    if(resultado == null) return false;
    if(typeof resultado === 'string') return false;
    if(resultado.aplica === false) return false;
    if(Array.isArray(resultado)) return resultado.length > 0;
    return Object.keys(resultado).length > 0;
}

/////detalle de por que no aplico, cuando el evaluador lo informa
function motivoNoAplica(resultado){
    if(resultado && typeof resultado === 'object' && resultado.aplica === false){
        return {motivo:resultado.motivo, faltante:resultado.faltante, unidad:resultado.unidad, mensaje:resultado.mensaje};
    }
    return {motivo:'no_alcanza', mensaje:'ninguna promocion aplicable a estos productos'};
}

function esDescuento(promo){ return promo.descuento === BENEFICIO.DESCUENTO; }

module.exports = {clasificar, clave, ambitoDe, metricaDe, soportada, evaluar, hayResultado, motivoNoAplica, esDescuento, EVALUADORES};
