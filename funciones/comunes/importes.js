const {IGV} = require('./constantes');

/////Importes de una cotizacion con la misma regla que el ERP.
/////
/////La regla se saco de los datos y no de un manual: contra las lineas de 2026 de la serie
/////009 en bdnava01 (176 155 en dolares y 10 225 en soles) explica el 100 %. Las que no
/////la cumplen son las que el vendedor tecleo con un precio final con IGV, y en esas el
/////ERP saca tota = totn / 1.18.
/////
/////    precio en soles  = redondear(precio US$ × tc, 3)        (preu y cost)
/////    precio con dscto = redondear(preu × (100 − dsct) / 100, 2)
/////    tota de la linea = redondear(precio con dscto × cant, 2)
/////    totn de la linea = redondear(tota × 1.18, 2)
/////    cabecera         = tota: suma de lineas; toti: redondear(tota × 0.18, 2); totn: tota + toti
/////
/////El redondeo es mitad hacia arriba (lejos del cero), como ROUND de SQL Server sobre
/////decimal. Se calcula con enteros exactos y no con coma flotante: 3.05 × 3.45 da
/////10.522499999... en float y se redondearia a 10.522 en vez de 10.523.

/////numero -> {n, e}: el valor es n / 10^e, con n entero (BigInt)
function exacto(valor){
    let s = String(Number(valor));
    if(/e/i.test(s)) s = Number(valor).toFixed(12);
    const negativo = s.startsWith('-');
    if(negativo) s = s.slice(1);
    const [entero, fraccion=''] = s.split('.');
    const n = BigInt(entero + fraccion);
    return {n: negativo ? -n : n, e: fraccion.length};
}

const potencia = (e)=>10n ** BigInt(e);

function multiplicar(a, b){ return {n: a.n * b.n, e: a.e + b.e}; }

function sumar(a, b){
    const e = Math.max(a.e, b.e);
    return {n: a.n * potencia(e - a.e) + b.n * potencia(e - b.e), e};
}
function restar(a, b){ return sumar(a, {n: -b.n, e: b.e}); }

/////redondea a d decimales, mitad lejos del cero, y devuelve un Number
function aNumero(x, d){
    let q;
    if(x.e <= d){
        q = x.n * potencia(d - x.e);
    }
    else{
        const divisor = potencia(x.e - d);
        const signo = x.n < 0n ? -1n : 1n;
        const absoluto = x.n * signo;
        q = absoluto / divisor;
        if((absoluto % divisor) * 2n >= divisor) q += 1n;
        q *= signo;
    }
    const negativo = q < 0n;
    const cifras = (negativo ? -q : q).toString().padStart(d + 1, '0');
    const texto = d > 0 ? cifras.slice(0, -d) + '.' + cifras.slice(-d) : cifras;
    return Number((negativo ? '-' : '') + texto);
}

const CON_IGV = sumar(exacto(1), exacto(IGV));     ////1.18 sin pasar por float
const CENTESIMO = {n: 1n, e: 2};

const redondear = (valor, d)=>aNumero(exacto(valor), d);

/////un precio en dolares a soles: preu y cost de las lineas en soles
const aSoles = (usd, tc)=>aNumero(multiplicar(exacto(usd), exacto(tc)), 3);

/////los importes de una linea a partir de su precio unitario, en la moneda que venga
function linea(preu, cant, dsct){
    const factor = multiplicar(restar(exacto(100), exacto(dsct)), CENTESIMO);
    const conDescuento = aNumero(multiplicar(exacto(preu), factor), 2);
    const tota = aNumero(multiplicar(exacto(conDescuento), exacto(cant)), 2);
    const totn = aNumero(multiplicar(exacto(tota), CON_IGV), 2);
    return {conDescuento, tota, totn};
}

/////la cabecera a partir de los tota de las lineas
function cabecera(totas){
    let suma = exacto(0);
    for(const t of totas) suma = sumar(suma, exacto(t));
    const tota = aNumero(suma, 2);
    const toti = aNumero(multiplicar(exacto(tota), exacto(IGV)), 2);
    const totn = aNumero(sumar(exacto(tota), exacto(toti)), 2);
    return {tota, toti, totn};
}

module.exports = {redondear, aSoles, linea, cabecera};
