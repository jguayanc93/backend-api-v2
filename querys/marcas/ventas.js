const {CODVTA_CUOTA, MESES_HISTORIA_CUOTA} = require('../../funciones/comunes/constantes')

/////Que cuenta como venta de una marca en un mes. Lo usan la cuota por marca y la cobertura
/////de clientes del grupo 25: tienen que contar exactamente lo mismo.
/////
/////  - facturas, boletas y notas de debito suman; las notas de credito restan
/////  - solo los tipos de venta de CODVTA_CUOTA (mercaderia y licitaciones)
/////  - la marca es la del producto (prd0101.codmar): los descuentos de promocion son lineas de
/////    marca ND y no entran, asi que no se restan
/////  - en dolares y sin IGV (la venta en soles se pasa con el tipo de cambio de la linea)
/////
/////Las consultas que usan esto tienen los alias a (dtl01fac), b (mst01fac) y p (prd0101) y los
/////parametros @anno y @mes.

/////el signo de cantidad y costo lo pone el tipo de documento: las notas de credito traen la
/////cantidad en positivo y hay que restarla; las de debito no mueven mercaderia
const SIGNO = "case a.cdocu when '01' then 1 when '03' then 1 when '07' then -1 else 0 end";

function enDolares(campo){ return `case a.mone when 'D' then ${campo} else ${campo}/nullif(a.tcam,0) end`; }

const VENTA = `sum(${enDolares('a.tota')})`;
const COSTO = `sum(${SIGNO} * a.cant * ${enDolares('a.cost')})`;
const UNIDADES = `sum(${SIGNO} * a.cant)`;

const DESDE = `from dtl01fac a
         join mst01fac b on b.cdocu=a.cdocu and b.ndocu=a.ndocu
         join prd0101 p on p.codi=a.codi`;

/////que documentos y tipos de venta cuentan, sin fijar el periodo
function dondeVenta(){
    return `b.flag<>'*' and b.cdocu in ('01','03','07','08')
           and b.codvta in (${CODVTA_CUOTA.map(v=>`'${v}'`).join(',')})`;
}

/////lo anterior, en el mes de @anno y @mes
function donde(){
    return `${dondeVenta()} and year(b.fecha)=@anno and month(b.fecha)=@mes`;
}

/////El mes que se pide (?anno=2026&mes=9). Sin nada: el mes en curso. Solo el mes en curso y
/////hasta "maximo" meses hacia atras (por defecto MESES_HISTORIA_CUOTA). Devuelve {anno, mes} o null.
function leerPeriodo(cuerpo, yo, maximo){
    const pideAnno = cuerpo && cuerpo.anno != null && cuerpo.anno !== '';
    const pideMes = cuerpo && cuerpo.mes != null && cuerpo.mes !== '';
    if(!pideAnno && !pideMes) return {anno:yo.anno, mes:yo.mes};
    if(!pideAnno || !pideMes) return null;
    const anno = Number(cuerpo.anno), mes = Number(cuerpo.mes);
    if(!Number.isInteger(anno) || !Number.isInteger(mes) || mes < 1 || mes > 12) return null;
    const atras = (yo.anno*12 + yo.mes) - (anno*12 + mes);
    if(atras < 0 || atras > (maximo == null ? MESES_HISTORIA_CUOTA : maximo)) return null;
    return {anno, mes};
}

module.exports={SIGNO, enDolares, VENTA, COSTO, UNIDADES, DESDE, donde, dondeVenta, leerPeriodo}
