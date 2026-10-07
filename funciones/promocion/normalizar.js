/////Los dos flujos de promocion leen la cotizacion de fuentes distintas:
/////  - /detalle  -> el carrito que manda el frontend (objeto con campos con nombre)
/////  - /mostrar  -> las filas de dtl01cot (arreglos con indices posicionales)
/////Por eso existian dos motores casi iguales. Aca ambas entradas se llevan a una
/////misma forma para que el motor sea uno solo.
const {COT, MARCA_BONIFICACION, CON_IGV} = require('../comunes/constantes');

/////forma comun de una linea:
/////{codigo, descripcion, cantidad, precioUnitario, totalSinIgv, totalConIgv,
///// item, documento, esBonificacion}

function aNumero(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

/////carrito del frontend: [{codigo,cantidad,precioUnitario,descuento,preciosinIGV,descripcion}]
function desdeCarrito(productos){
    const lineas = {};
    const codigos = [];

    for(const i in productos){
        const p = productos[i];
        if(!p || p.codigo == null) continue;

        const codigo = String(p.codigo).trim();
        const totalSinIgv = aNumero(p.preciosinIGV);

        codigos.push(codigo);
        lineas[codigo] = {
            codigo,
            descripcion: p.descripcion != null ? p.descripcion : '',
            cantidad: aNumero(p.cantidad),
            precioUnitario: aNumero(p.precioUnitario),
            totalSinIgv,
            totalConIgv: Number((totalSinIgv * CON_IGV).toFixed(2)),
            descuento: aNumero(p.descuento),
            item: null,
            documento: null,
            esBonificacion: false,
            /////ALIAS: los evaluadores (vx_unidad, vx_unidades, vx_valorizados) leen
            /////estos nombres tal como los manda el frontend. Se conservan para no
            /////romperlos; el codigo nuevo usa los nombres normalizados de arriba.
            preciosinIGV: totalSinIgv,
            /////se conserva el original por si algun evaluador necesita un campo suelto
            crudo: p
        };
    }

    return {codigos, lineas};
}

/////filas de dtl01cot ya mapeadas a objetos con claves "0","1","2"...
function desdeDetalleBD(filas){
    const lineas = {};
    const codigos = [];
    let documento = null;

    for(const i in filas){
        const f = filas[i];
        if(!f) continue;

        const codigo = String(f[COT.CODI] == null ? '' : f[COT.CODI]).trim();
        const descripcion = f[COT.DESCR] != null ? String(f[COT.DESCR]) : '';
        if(documento === null) documento = f[COT.NDOCU];

        codigos.push(codigo);
        lineas[codigo] = {
            codigo,
            descripcion,
            cantidad: aNumero(f[COT.CANT]),
            precioUnitario: aNumero(f[COT.PREU]),
            totalSinIgv: aNumero(f[COT.TOTA]),
            totalConIgv: aNumero(f[COT.TOTN]),
            descuento: aNumero(f[COT.DSCT]),
            item: f[COT.ITEM],
            documento: f[COT.NDOCU],
            /////las lineas que ya son regalo de promocion no vuelven a entrar al calculo
            esBonificacion: descripcion.substring(0, MARCA_BONIFICACION.length) === MARCA_BONIFICACION,
            crudo: f
        };
    }

    return {codigos, lineas, documento};
}

/////totales de cabecera a partir de las lineas (antes se acumulaban con indices [16] y [18])
function totalesCabecera(lineas){
    let sinIgv = 0;
    let conIgv = 0;
    for(const k in lineas){
        sinIgv += lineas[k].totalSinIgv;
        conIgv += lineas[k].totalConIgv;
    }
    return {sinIgv, conIgv};
}

module.exports = {desdeCarrito, desdeDetalleBD, totalesCabecera};
