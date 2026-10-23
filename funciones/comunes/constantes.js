/////valores de negocio que estaban repetidos como literales por todo el modulo.
/////tenerlos en un solo sitio evita que se corrija uno y se olviden los otros.

const IGV = 0.18;
const CON_IGV = 1 + IGV;

/////SKU con el que el ERP registra una linea de descuento por promocion
const SKU_DESCUENTO = '0303-010001';

/////marcadores de texto en dtl01cot.descr con los que se reconoce una linea de promocion
const MARCA_BONIFICACION = 'GRATIS/PROM';
const MARCA_DESCUENTO = 'DSCTO/PROM: ';
const MARCA_FLETE = 'DSCTO/PROM: FLETE PROVINCIA';

/////el ERP corta la descripcion del detalle a 80 caracteres
const LARGO_DESCRIPCION = 80;

/////El ndocu es char(12): 3 caracteres de serie + "-" + 8 digitos.
/////Conviven al menos dos series: "009-" (841 749 cotizaciones, la principal) y
/////"098-" (las que crea /pegar). Por eso, si llega solo el numero suelto (970435)
/////NO se puede deducir la serie y se rechaza por ambiguo en vez de asumir una.
const SERIES_CONOCIDAS = ["009","098","099","020"];

/////Devuelve el ndocu completo y normalizado, o null si no se puede resolver.
function normalizarNdocu(valor){
    const v = String(valor == null ? "" : valor).trim();
    if(v === "") return null;

    const conSerie = v.match(/^([0-9]{3})-([0-9]{1,8})$/);
    if(conSerie){
        /////se rellena con ceros a la izquierda hasta los 8 digitos del formato
        return conSerie[1] + "-" + conSerie[2].padStart(8,"0");
    }

    /////numero suelto, sin serie: ambiguo
    return null;
}

/////Variante tolerante para los queries antiguos: acepta el ndocu completo y, por
/////compatibilidad con el frontend que todavia manda el numero suelto, le antepone
/////la serie historica "009-00" como se hacia antes. Los endpoints nuevos usan
/////normalizarNdocu, que rechaza el numero suelto por ambiguo.
const PREFIJO_LEGADO = "009-00";
function resolverNdocu(valor){
    const completo = normalizarNdocu(valor);
    if(completo !== null) return completo;

    const n = String(valor == null ? "" : valor).trim();
    if(/^[0-9]{1,8}$/.test(n)) return PREFIJO_LEGADO + n;
    return null;
}

/////posiciones de las columnas tal como las devuelve cada consulta.
/////dtl01cot: select fecha,cdocu,ndocu,codcli,tcam,mone,moneitm,aigv,item,codi,
/////         codf,marc,umed,descr,cant,preu,tota,dsct,totn,codalm,cost,msto,ucon,ucom,obse
const COT = {
    FECHA:0, CDOCU:1, NDOCU:2, CODCLI:3, TCAM:4, MONE:5, MONEITM:6, AIGV:7,
    ITEM:8, CODI:9, CODF:10, MARC:11, UMED:12, DESCR:13, CANT:14, PREU:15,
    TOTA:16, DSCT:17, TOTN:18, CODALM:19, COST:20, MSTO:21, UCON:22, UCOM:23, OBSE:24
};

/////mst_promocion: select idprom,nomprom,desprom,porvta,tipdsct,tipdsctoto,
/////               metrica,undvtaprom,lpdsct,idagrupa,prioagrupa
const PROM = {
    IDPROM:0, NOMBRE:1, DESCRIPCION:2, VENTA:3, DESCUENTO:4, OTORGA:5,
    METRICA:6, UNDVTA:7, LPDSCT:8, AGRUPADO:9, PRIORIDAD:10
};

/////dtl_promocion_progra join prd0101: select a.codi,a.monto,a.dsct,a.boncodf,
/////                                   a.stoclim,b.marc,a.idprom,b.pcus
const PROMDET = {
    CODI:0, MONTO:1, DSCT:2, BONCODF:3, STOCLIM:4, MARC:5, IDPROM:6, PCUS:7
};

/////valores que toman los ejes de clasificacion de una promocion
/////Valores verificados contra bdnava01 (mst_promocion) el 2026-09-28.
/////OJO: metrica vale 1 o 2, NO 1 o 3. xtotalisados.js ya branchaba con ===1 / ===2;
/////los comentarios del codigo que hablaban de 3 estaban equivocados.
const AMBITO = {POR_ITEM:1, POR_TOTAL_VENTA:3};
const BENEFICIO = {DESCUENTO:1, REGALO:3};
const OTORGA = {MONTO:1, UNIDADES:3};
const METRICA = {VALORIZADO:1, UNIDADES:2};

/////AAAA-MM-DD es lo que mandan las pantallas; se entrega como AAAAMMDD, el unico
/////formato que SQL Server interpreta igual sin importar el idioma del servidor.
function normalizarFecha(valor){
    if(typeof valor !== 'string') return null;
    const limpio = valor.trim();
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(limpio)) return null;
    return limpio.replace(/-/g,'');
}

/////Diferenciadores que puede elegir cada grupo al registrarse. Son los que existen hoy en
/////tbl_api_vendedores_diferenciador. Antes el registro aceptaba cualquier texto, y ese
/////texto arma la ruta /v1/vendedor/<tipo>: un tipo inventado terminaba en un 404.
const TIPOS_POR_GRUPO = {
    20: ['COBERTURA','CARTERA'],
    25: ['ESPECIALISTA','JEFATURA'],
    34: ['ZONA'],
    39: ['HP']          ////CHAKAL ya no se usa (2026-10-16); quien ya esta registrado asi no se toca
};

/////El grupo 25 elige marcas al registrarse. El tope solo frena un envio absurdo:
/////un especialista lleva de 1 a unas 20.
const MAX_MARCAS_REGISTRO = 50;

/////Reporte de tiempo en almacen: los dias se cuentan desde la ultima entrada con alguna
/////de estas glosas del kardex (01 compra en el pais, 02 compra en el exterior). Se dejan
/////fuera las devoluciones de cliente (05), los ajustes (09) y la proteccion de precio (21):
/////una devolucion de una unidad haria parecer recien llegado un stock de meses.
const GLOSAS_COMPRA = ['01','02'];
/////cuantos años de kardex se revisan hacia atras, contando el actual
const ANNOS_KARDEX = 4;

/////Cuota por marca: tipos de venta (mst01fac.codvta, catalogo tbl01vta) que suman al avance.
/////01 mercaderia y 08 licitaciones; no cuentan venta al exterior (07), servicios (02),
/////transferencia gratuita (04) ni anticipos. Decision de negocio del 2026-10-19.
const CODVTA_CUOTA = ['01','08'];

/////Cuota por marca: cuantos meses hacia atras se pueden consultar (solo lectura)
const MESES_HISTORIA_CUOTA = 2;

/////Grupo 34 (jefe de zona): solo estos usuarios (codusu) pueden entrar. 297 MOSCOSO DIEGO
/////queda fuera hasta que se decida (2026-10-22). Para darle acceso, agregarlo aqui.
const ACCESO_GRUPO_34 = ['126'];
/////Avance de zona: cuantos meses hacia atras se pueden consultar
const MESES_HISTORIA_ZONA = 2;
/////Probabilidad: con cuantos meses anteriores se compara el mes en curso
const MESES_COMPARAR_PROBABILIDAD = 3;
/////Probabilidad: cuantos dias hacia atras se miran las ventas de cada vendedor
const DIAS_HISTORIA_PROBABILIDAD = 90;

module.exports = {
    IGV, CON_IGV,
    SKU_DESCUENTO, MARCA_BONIFICACION, MARCA_DESCUENTO, MARCA_FLETE,
    LARGO_DESCRIPCION, SERIES_CONOCIDAS, normalizarNdocu, resolverNdocu, PREFIJO_LEGADO,
    COT, PROM, PROMDET,
    AMBITO, BENEFICIO, OTORGA, METRICA,
    normalizarFecha,
    TIPOS_POR_GRUPO, MAX_MARCAS_REGISTRO, GLOSAS_COMPRA, ANNOS_KARDEX, CODVTA_CUOTA, MESES_HISTORIA_CUOTA,
    ACCESO_GRUPO_34, MESES_HISTORIA_ZONA, MESES_COMPARAR_PROBABILIDAD, DIAS_HISTORIA_PROBABILIDAD
};
