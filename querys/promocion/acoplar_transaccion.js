const {Request,TYPES} = require('../../conexion/cadena');
const {SKU_DESCUENTO, MARCA_BONIFICACION, IGV, CON_IGV} = require('../../funciones/comunes/constantes');

/////Inserta las lineas de promocion ya calculadas por el servidor y recalcula la cabecera,
/////todo en UNA conexion y dentro de una transaccion. Antes eran 4 conexiones sueltas y la
/////cabecera se actualizaba ANTES de insertar las lineas: si el bucle fallaba a mitad,
/////quedaban lineas de menos y una cabecera que ya las contaba.

function ejecutar(conexion, sql, parametros, procedimiento){
    return new Promise((resolve,reject)=>{
        const consulta = new Request(sql,(err,rowCount,rows)=>{
            if(err) return reject(err);
            resolve({rows:rows||[]});
        });
        (parametros||[]).forEach(p=>consulta.addParameter(p.nombre,p.tipo,p.valor));
        procedimiento ? conexion.callProcedure(consulta) : conexion.execSql(consulta);
    });
}
/////el rowCount de tedious cuenta result sets, no filas afectadas: hay que pedir @@ROWCOUNT
function ejecutarContando(conexion, sql, parametros){
    return ejecutar(conexion, sql+"; select @@ROWCOUNT as afectadas;", parametros)
        .then(r => (r.rows.length ? Number(r.rows[0][0].value) : 0));
}
function iniciar(c){ return new Promise((res,rej)=>c.beginTransaction(e=>e?rej(e):res(),'acoplar_promos')); }
function confirmar(c){ return new Promise((res,rej)=>c.commitTransaction(e=>e?rej(e):res())); }
function revertir(c){ return new Promise((res)=>c.rollbackTransaction(()=>res())); }

/////la cotizacion debe existir, ser del vendedor y seguir abierta.
/////flag/estado se comparan como texto: las eliminadas tienen flag='*' y compararlo
/////contra un numero revienta la conversion.
function validar(conexion, documento, codven){
    return ejecutar(conexion,
        "select ndocu from mst01cot with (updlock) where ndocu=@coti and codven_usu=@codven and flag='0' and estado='0'",
        [{nombre:'coti',tipo:TYPES.VarChar,valor:documento},
         {nombre:'codven',tipo:TYPES.VarChar,valor:codven}]).then(r=>r.rows.length>0);
}

/////solo se aceptan lineas que sean realmente de promocion
function esLineaDePromocion(l){
    const codi = String(l[11]==null?'':l[11]).trim();
    const descr = String(l[15]==null?'':l[15]);
    return codi===SKU_DESCUENTO || descr.substring(0,MARCA_BONIFICACION.length)===MARCA_BONIFICACION;
}

function insertarLinea(conexion, l){
    return ejecutar(conexion,"GrabaDTLCotFacWeb",[
        {nombre:'cdocu',tipo:TYPES.Char,valor:l[1]},
        {nombre:'ndocu',tipo:TYPES.Char,valor:l[2]},
        {nombre:'codcli',tipo:TYPES.Char,valor:l[3]},
        {nombre:'tcam',tipo:TYPES.Float,valor:l[4]},
        {nombre:'mone',tipo:TYPES.Char,valor:l[8]},
        {nombre:'moneitm',tipo:TYPES.Char,valor:l[9]},
        {nombre:'aigv',tipo:TYPES.Char,valor:l[10]},
        {nombre:'item',tipo:TYPES.Float,valor:l[6]},
        {nombre:'codi',tipo:TYPES.Char,valor:l[11]},
        {nombre:'codf',tipo:TYPES.Char,valor:l[12]},
        {nombre:'marc',tipo:TYPES.Char,valor:l[13]},
        {nombre:'umed',tipo:TYPES.Char,valor:l[14]},
        {nombre:'descr',tipo:TYPES.Char,valor:l[15]},
        {nombre:'cant',tipo:TYPES.Float,valor:l[7]},
        {nombre:'preu',tipo:TYPES.Float,valor:l[16]},
        {nombre:'tota',tipo:TYPES.Float,valor:l[17]},
        {nombre:'dsct',tipo:TYPES.Float,valor:l[18]},
        {nombre:'totn',tipo:TYPES.Float,valor:l[19]},
        {nombre:'AnulaDetalle',tipo:TYPES.Char,valor:''},
        {nombre:'codalm',tipo:TYPES.Char,valor:l[20]},
        {nombre:'cost',tipo:TYPES.Float,valor:l[21]},
        {nombre:'msto',tipo:TYPES.Char,valor:l[22]},
        {nombre:'ucon',tipo:TYPES.Float,valor:l[23]},
        {nombre:'ucom',tipo:TYPES.Char,valor:l[24]},
        {nombre:'obse',tipo:TYPES.VarChar,valor:l[25]}
    ], true);
}

/////recalcula la cabecera desde el detalle (SUM), no sumando deltas: asi es idempotente
/////y no se descuadra si una promocion se acopla dos veces. toti se deriva de la
/////diferencia para que tota+toti=totn cuadre siempre.
async function recalcularCabecera(conexion, documento){
    const suma = await ejecutar(conexion,
        "select ISNULL(SUM(tota),0) as tota from dtl01cot where ndocu=@coti",
        [{nombre:'coti',tipo:TYPES.VarChar,valor:documento}]);
    const tota = Number(suma.rows[0][0].value);

    /////Se usa la MISMA formula que el ERP aplica en el trigger trg_mst01cot_Promo:
    /////   toti = SUM(tota)*0.18   y   totn = SUM(tota)*1.18
    /////Antes se tomaba totn como la suma de los totn de linea, que difiere por centavos
    /////de redondeo: el trigger corregia la diferencia cuando habia linea 0303-010001 y
    /////la dejaba pasar cuando no, dejando la cabecera desviada.
    const toti = Number((tota * IGV).toFixed(2));
    const totn = Number((tota * CON_IGV).toFixed(2));

    const afectadas = await ejecutarContando(conexion,
        "update mst01cot set tota=@tota, toti=@toti, totn=@totn where ndocu=@coti and flag='0' and estado='0'",
        [{nombre:'tota',tipo:TYPES.Float,valor:tota},
         {nombre:'toti',tipo:TYPES.Float,valor:toti},
         {nombre:'totn',tipo:TYPES.Float,valor:totn},
         {nombre:'coti',tipo:TYPES.VarChar,valor:documento}]);
    return {afectadas, tota, toti, totn};
}

module.exports={ejecutar, ejecutarContando, iniciar, confirmar, revertir,
                validar, esLineaDePromocion, insertarLinea, recalcularCabecera};
