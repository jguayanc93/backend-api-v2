/////Un solo lugar donde vive la regla de cuanto otorga una promocion.
/////Se ramifica primero por TIPO (descuento o regalo) y recien despues por OTORGA,
/////porque todas las promos de regalo traen otorga=1 y confundirian las ramas.
/////
/////OJO: dsct significa cosas distintas segun el ambito, y esta comprobado con datos:
/////  - POR ITEM       -> dsct es POR BLOQUE alcanzado  (veces x dsct)
/////  - POR TOTALVENTA -> dsct es POR UNIDAD            ((veces x umbral) x dsct)
/////Con la lectura cruzada salen disparates: en las promos reales por item la lectura
/////"por unidad" daba hasta 829% de la venta, y en las de totalventa la lectura
/////"por bloque" daba 0.005%, o sea nada.
const {CON_IGV, BENEFICIO, OTORGA, AMBITO, METRICA} = require('../comunes/constantes');

/////  promo  -> objeto de motor.clasificar()
/////  veces  -> cuantas veces se alcanzo el umbral (floor: el sobrante se pierde)
/////  umbral -> monto de dtl_promocion_progra (unidades o dinero segun la metrica)
/////  base   -> monto sin IGV sobre el que corre un descuento porcentual; es la parte
/////            que alcanzo el umbral, no el total de la linea
/////  dsct   -> columna dsct de dtl_promocion_progra
function calcular(promo, {veces, umbral, base, dsct}){
    const d = Number(dsct);
    const n = Number(veces);

    /////REGALO: dsct son unidades de obsequio, siempre por bloque. Ni IGV ni porcentaje.
    if(Number(promo.descuento) !== BENEFICIO.DESCUENTO){
        return Number((n * d).toFixed(2));
    }

    /////DESCUENTO PORCENTUAL: el porcentaje es FIJO (no se multiplica por veces) y corre
    /////sobre la base, que ya viene sin IGV.
    if(Number(promo.otorga) === OTORGA.MONTO){
        return Number(((Number(base) * d) / 100).toFixed(2));
    }

    /////DESCUENTO DE MONTO FIJO: en la tabla esta cargado CON IGV (1.18 -> 1, 5.90 -> 5)
    /////y la respuesta sale sin IGV.
    /////En totalventa por unidades el dsct es por unidad, asi que se cobra sobre las
    /////unidades que calificaron; en los demas casos es por bloque alcanzado.
    const porUnidad = Number(promo.venta) === AMBITO.POR_TOTAL_VENTA
                   && Number(promo.metrica) === METRICA.UNIDADES;

    const cantidadAplicable = porUnidad ? (n * Number(umbral)) : n;
    return Number(((cantidadAplicable * d) / CON_IGV).toFixed(2));
}

/////etiqueta de la unidad en que esta expresado el beneficio, util para el frontend
function unidad(promo){
    if(Number(promo.descuento) !== BENEFICIO.DESCUENTO) return 'unidades';
    return Number(promo.otorga) === OTORGA.MONTO ? 'porcentaje' : 'monto';
}

module.exports = {calcular, unidad};
