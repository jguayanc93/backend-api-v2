/////Evaluador del lado BD para promociones POR ITEM: cada producto de la cotizacion se
/////mide por separado contra el umbral de la promocion.
/////
/////La metrica decide con que se compara:
/////   UNIDADES   -> la cantidad de la linea (dtl01cot.cant)
/////   VALORIZADO -> el monto sin IGV de la linea (dtl01cot.tota)
/////Antes la rama valorizado apuntaba a una funcion vacia y devolvia undefined.
const {COT, PROMDET, METRICA, MARCA_BONIFICACION} = require('../comunes/constantes');

let descuento_correspondiente=(nprom,cotdetalle,promcabesa,promdetalle,tipopromo,tipometrica)=>{
    const numero_item = Object.keys(cotdetalle).length;
    const campo = Number(tipometrica)===METRICA.VALORIZADO ? COT.TOTA : COT.CANT;
    return recorrer(cotdetalle, promdetalle, numero_item, campo);
};

/////recorre el detalle de la cotizacion y se queda con las lineas que alcanzan el umbral
function recorrer(cotdetalle, promdetalle, numero_item, campo){
    let numero_documento;
    let cabesatota = 0;
    let cabesatotn = 0;
    let n_item = numero_item + 1;
    let items_validos2 = {};
    let items_promos2 = {};

    for(const x in cotdetalle){
        const linea = cotdetalle[x];
        numero_documento = linea[COT.NDOCU];
        cabesatota += parseFloat(linea[COT.TOTA]);
        cabesatotn += parseFloat(linea[COT.TOTN]);

        for(const y in promdetalle){
            if(promdetalle[y][PROMDET.CODI] != linea[COT.CODI]) continue;

            const umbral = promdetalle[y][PROMDET.MONTO];
            const tiene  = linea[campo];                 ////cantidad o valorizado segun la metrica
            const descr  = String(linea[COT.DESCR] == null ? '' : linea[COT.DESCR]);

            /////una linea que ya es regalo de promocion no vuelve a entrar al calculo
            if(descr.substring(0, MARCA_BONIFICACION.length) === MARCA_BONIFICACION) continue;
            if(!(Number(umbral) > 0) || Number(tiene) < Number(umbral)) continue;

            items_validos2[linea[COT.CODI]] = items_aceptados(linea, tiene, umbral, n_item);
            items_promos2[promdetalle[y][PROMDET.CODI]] = [
                promdetalle[y][0],promdetalle[y][1],promdetalle[y][2],promdetalle[y][3],
                promdetalle[y][4],promdetalle[y][5],promdetalle[y][6],promdetalle[y][7]
            ];
            n_item++;
        }
    }

    return [items_validos2, items_promos2, numero_documento, cabesatota, cabesatotn];
}

/////  fecha, cdocu, ndocu, codcli, tcam, descripcion del item, numero de item, veces
function items_aceptados(linea, tiene, umbral, numero_item){
    const veces = Math.floor(Number(tiene) / Number(umbral));
    return [linea[COT.FECHA], linea[COT.CDOCU], linea[COT.NDOCU], linea[COT.CODCLI],
            linea[COT.TCAM], linea[COT.DESCR], numero_item, veces];
}

module.exports = descuento_correspondiente;
