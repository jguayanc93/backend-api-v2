/////Simulador de escenarios de promocion. Pasa carritos por el motor real (/detalle).
/////Uso: node simular_promos.js
const motor = require('./funciones/promocion/motor');
const beneficio = require('./funciones/promocion/beneficio');
const {desdeCarrito} = require('./funciones/promocion/normalizar');

/////arma la fila de mst_promocion tal como la devuelve el query
function cabecera(idprom,nombre,venta,tipo,otorga,metrica){
    return {0:idprom,1:nombre,2:'',3:venta,4:tipo,5:otorga,6:metrica,7:0,8:0,9:0,10:0};
}
/////arma dtl_promocion_progra: codi, monto, dsct, boncodf, stoclim, marc, idprom, pcus
function renglon(codi,monto,dsct,boncodf){
    return [codi,monto,dsct,boncodf||'',0,'ND','9999',0];
}

function correr(titulo,cab,renglones,carro,nota){
    const promo = motor.clasificar(cab);
    const c = desdeCarrito(carro);
    const det = {}; renglones.forEach((r,i)=>det[i]=r);

    console.log('');
    console.log('  ' + titulo);
    console.log('  ' + '-'.repeat(titulo.length));
    console.log('   promo: ' + promo.nombre + '   [' + (promo.venta===1?'item':'totalventa') + ' / ' +
                (promo.descuento===1?'descuento':'regalo') + ' / ' + (promo.metrica===1?'valorizado':'unidades') +
                '] beneficio en ' + beneficio.unidad(promo));
    renglones.forEach(r=>console.log('   regla: codi=' + r[0] + '  umbral=' + r[1] + (promo.metrica===1?' (dinero)':' (unidades)') + '  dsct=' + r[2] + (r[3]?('  regalo='+r[3]):'')));
    for(const k in carro){
        const p = carro[k];
        console.log('   carrito: ' + p.codigo + '  cant=' + p.cantidad + '  valorizado=' + p.preciosinIGV);
    }

    let r;
    try{ r = motor.evaluar({promo,origen:'carrito',codigos:c.codigos,cotdetalle:c.lineas,promcabesa:cab,promdetalle:det,tipopromo:promo}); }
    catch(e){ console.log('   >> RECHAZA: ' + e); return; }

    if(!motor.hayResultado(r)){ console.log('   >> NO APLICA: ' + r); return; }

    const unidad = beneficio.unidad(promo);
    let n=0;
    for(const k in r){
        if(k==='tipo' || k==='descripcion') continue;
        const it = r[k];
        const sufijo = unidad==='unidades' ? ' unidades de regalo' : ' USD de descuento (sin IGV)';
        console.log('   >> ' + it.itemdescr + ' | veces=' + it.cantidad + ' | ' + it.montoDescuento + sufijo);
        n++;
    }
    console.log('   >> ' + n + ' linea(s) de promocion, tipo=' + r.tipo);
    if(nota) console.log('   nota: ' + nota);
}

const L = (t)=>{ console.log(''); console.log('='.repeat(78)); console.log(t); console.log('='.repeat(78)); };

/////=================== COMBINACION 2 (25 activas) ===================
L('COMBINACION 2 - item . descuento . unidades      [promo real 14656]');
const c2 = cabecera('14656','PROMOCION AMD RYZEN Q3 2026',1,1,3,2);
const r2 = [renglon('0603-020101',1,494.42)];

correr('A) compra 1 unidad', c2, r2,
  {0:{codigo:'0603-020101',descripcion:'CPU AMD RYZEN 9 5950X',cantidad:1,preciosinIGV:780}},
  '494.42 esta cargado CON IGV -> 494.42/1.18 = 419.00');

correr('B) compra 3 unidades (escalonado)', c2, r2,
  {0:{codigo:'0603-020101',descripcion:'CPU AMD RYZEN 9 5950X',cantidad:3,preciosinIGV:2340}},
  'umbral=1 -> veces = cantidad. 3 * 419 = 1257.00');

correr('C) producto que NO esta en la promo', c2, r2,
  {0:{codigo:'0505-012610',descripcion:'TONER TN-450',cantidad:5,preciosinIGV:172.61}});

correr('D) dos productos de la promo -> dos lineas', c2,
  [renglon('0603-020101',1,494.42), renglon('0603-020113',1,193.52)],
  {0:{codigo:'0603-020101',descripcion:'RYZEN 9 5950X',cantidad:2,preciosinIGV:1560},
   1:{codigo:'0603-020113',descripcion:'RYZEN 7 5700G',cantidad:1,preciosinIGV:346}},
  '193.52/1.18 = 164.00');

correr('E) umbral 4 unidades, compra 10 (no multiplo)', c2,
  [renglon('0603-020101',4,494.42)],
  {0:{codigo:'0603-020101',descripcion:'RYZEN 9 5950X',cantidad:10,preciosinIGV:7800}},
  'floor(10/4)=2 -> 2*419 = 838.00. Las 2 unidades sobrantes no suman');

/////=================== COMBINACION 4 (8 activas) ===================
L('COMBINACION 4 - item . regalo . unidades         [promo real 14106]');
const c4 = cabecera('14106','PROMOCION ANTEC CABLE CSK & GSK',1,3,1,2);

correr('A) compra 3 unidades, 1 regalo por unidad', c4,
  [renglon('0608-020258',1,1,'CAPA10US')],
  {0:{codigo:'0608-020258',descripcion:'PSU ANTEC CSK 550W',cantidad:3,preciosinIGV:195}},
  'dsct=1 son UNIDADES de obsequio, no se divide entre 1.18');

correr('B) umbral 2 unidades, compra 7', c4,
  [renglon('0608-020258',2,1,'CAPA10US')],
  {0:{codigo:'0608-020258',descripcion:'PSU ANTEC CSK 550W',cantidad:7,preciosinIGV:455}},
  'floor(7/2)=3 regalos');

correr('C) no alcanza el umbral', c4,
  [renglon('0608-020258',5,1,'CAPA10US')],
  {0:{codigo:'0608-020258',descripcion:'PSU ANTEC CSK 550W',cantidad:3,preciosinIGV:195}});

/////=================== COMBINACION 1 (0 activas, implementada) ===================
L('COMBINACION 1 - item . descuento . valorizado    [sin promos activas]');

correr('A) monto fijo: umbral 500 USD, dsct 5.90', cabecera('9001','PROMO VALORIZADO FIJO',1,1,3,1),
  [renglon('0603-020101',500,5.9)],
  {0:{codigo:'0603-020101',descripcion:'RYZEN 9 5950X',cantidad:4,preciosinIGV:1700}},
  'floor(1700/500)=3 -> 3*5.90/1.18 = 15.00');

correr('B) porcentual: umbral 500 USD, dsct 5.9%', cabecera('9002','PROMO VALORIZADO %',1,1,1,1),
  [renglon('0603-020101',500,5.9)],
  {0:{codigo:'0603-020101',descripcion:'RYZEN 9 5950X',cantidad:4,preciosinIGV:1700}},
  '1700 * 5.9% = 100.30. El porcentaje NO se divide entre 1.18');

correr('C) no alcanza el umbral de dinero', cabecera('9001','PROMO VALORIZADO FIJO',1,1,3,1),
  [renglon('0603-020101',5000,5.9)],
  {0:{codigo:'0603-020101',descripcion:'RYZEN 9 5950X',cantidad:1,preciosinIGV:780}});

/////=================== COMBINACION 3 (0 activas, implementada) ===================
L('COMBINACION 3 - item . regalo . valorizado       [sin promos activas]');

correr('A) umbral 500 USD, 2 regalos por vez', cabecera('9003','PROMO REGALO VALORIZADO',1,3,1,1),
  [renglon('0608-020258',500,2,'CAPA10US')],
  {0:{codigo:'0608-020258',descripcion:'PSU ANTEC CSK 550W',cantidad:10,preciosinIGV:1700}},
  'floor(1700/500)=3 veces * 2 = 6 regalos. Sin IGV ni porcentaje');

console.log('');
