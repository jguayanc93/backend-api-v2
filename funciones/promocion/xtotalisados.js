/////Evaluador del lado BD para promociones POR TOTAL DE VENTA: el umbral se mide sobre el
/////CONJUNTO de productos de la promocion presentes en la cotizacion, y se otorga un solo
/////beneficio para todo el conjunto.
/////
/////La metrica decide que se acumula:
/////   UNIDADES   -> la cantidad de cada linea (dtl01cot.cant)
/////   VALORIZADO -> el monto sin IGV de cada linea (dtl01cot.tota)
/////
/////Reescrito para que coincida con el evaluador del carrito (porTotalVenta.js). La version
/////anterior calculaba las veces por otro camino y daba numeros distintos: con la promo
/////13235 (umbral 236, conjunto 21 774.02) el carrito daba 92 y este lado daba 5.
const {COT, PROMDET, METRICA, MARCA_BONIFICACION} = require('../comunes/constantes');

let descuento_correspondiente = (nprom,cotdetalle,promcabesa,promdetalle,tipopromo,tipometrica)=>{
    const numero_item = Object.keys(cotdetalle).length;
    const campo = Number(tipometrica) === METRICA.VALORIZADO ? COT.TOTA : COT.CANT;
    return recorrer(cotdetalle, promdetalle, numero_item, campo);
};

function recorrer(cotdetalle, promdetalle, numero_item, campo){
    /////1) definicion de la promocion. El umbral es unico por promocion (verificado en BD
    /////   sobre las 9 de total venta activas), asi que se toma del primer renglon.
    const porCodi = {};
    let umbral = 0;
    let primerRenglon = null;
    for(const y in promdetalle){
        const codi = promdetalle[y][PROMDET.CODI];
        porCodi[codi] = promdetalle[y];
        if(primerRenglon === null){
            primerRenglon = promdetalle[y];
            umbral = Number(promdetalle[y][PROMDET.MONTO]);
        }
    }

    /////2) acumular el aporte del conjunto y quedarse con los productos que participan
    let acumulado = 0;
    let cabesatota = 0;
    let cabesatotn = 0;
    let numero_documento;
    let primeraLinea = null;
    const items_validos2 = {};

    for(const x in cotdetalle){
        const linea = cotdetalle[x];
        numero_documento = linea[COT.NDOCU];
        cabesatota += parseFloat(linea[COT.TOTA]);
        cabesatotn += parseFloat(linea[COT.TOTN]);

        const codi = linea[COT.CODI];
        if(!porCodi[codi]) continue;

        /////una linea que ya es regalo de promocion no vuelve a entrar al calculo
        const descr = String(linea[COT.DESCR] == null ? '' : linea[COT.DESCR]);
        if(descr.substring(0, MARCA_BONIFICACION.length) === MARCA_BONIFICACION) continue;

        acumulado += Number(linea[campo]);
        items_validos2[codi] = porCodi[codi];
        if(primeraLinea === null) primeraLinea = linea;
    }

    /////3) no aplica: se informa el motivo y cuanto falta, igual que el lado carrito
    if(primeraLinea === null){
        return {aplica:false, motivo:"no_participa",
                mensaje:"ninguno de los productos de la cotizacion participa en esta promocion"};
    }
    if(!(umbral > 0) || acumulado < umbral){
        const falta = umbral > 0 ? Number((umbral - acumulado).toFixed(2)) : null;
        const unidad = campo === COT.TOTA ? "monto" : "unidades";
        return {aplica:false, motivo:"no_alcanza", faltante:falta, unidad:unidad,
                mensaje: falta === null ? "la promocion no tiene umbral valido"
                       : (unidad === "unidades"
                          ? ("faltan "+falta+" unidades en el conjunto para alcanzar la promocion")
                          : ("falta "+falta+" de valorizado en el conjunto para alcanzar la promocion"))};
    }

    const veces = Math.floor(acumulado / umbral);

    /////4) una sola entrada para todo el conjunto.
    /////   La forma la consumen descuento.js y bonificacion.js por posicion:
    /////   [fecha, cdocu, ndocu, codcli, tcam, descripcion, numero de item, veces]
    const retorno_conjunto = [
        primeraLinea[COT.FECHA], primeraLinea[COT.CDOCU], primeraLinea[COT.NDOCU],
        primeraLinea[COT.CODCLI], primeraLinea[COT.TCAM], "item nombre",
        numero_item + 1, veces
    ];

    /////items_promos2 se indexa por [0] aguas abajo para leer umbral y dsct
    const items_promos2 = Object.keys(items_validos2).map(k => items_validos2[k]);
    if(items_promos2.length === 0 && primerRenglon) items_promos2.push(primerRenglon);

    return [retorno_conjunto, items_validos2, items_promos2, numero_documento, cabesatota, cabesatotn];
}

module.exports = descuento_correspondiente;
