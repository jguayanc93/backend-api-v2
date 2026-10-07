const {Request,TYPES} = require('../../conexion/cadena');
const {SKU_DESCUENTO, MARCA_BONIFICACION, MARCA_FLETE, IGV, CON_IGV} = require('../../funciones/comunes/constantes');

/////Quita promociones de una cotizacion en UNA sola conexion y dentro de una transaccion.
/////Antes esto eran 3 conexiones distintas sin transaccion: si fallaba a mitad, las lineas
/////quedaban borradas y la cabecera con los montos viejos.

function ejecutar(conexion, sql, parametros){
    return new Promise((resolve,reject)=>{
        const consulta = new Request(sql,(err,rowCount,rows)=>{
            if(err) return reject(err);
            resolve({rowCount:rowCount, rows:rows||[]});
        });
        (parametros||[]).forEach(p=>consulta.addParameter(p.nombre,p.tipo,p.valor));
        conexion.execSql(consulta);
    });
}
/////OJO: el rowCount que entrega tedious cuenta result sets, no filas afectadas:
/////devuelve 1 para un UPDATE que no toco nada. El unico valor confiable es @@ROWCOUNT.
function ejecutarContando(conexion, sql, parametros){
    return ejecutar(conexion, sql+"; select @@ROWCOUNT as afectadas;", parametros)
        .then(r => (r.rows.length ? Number(r.rows[0][0].value) : 0));
}
function iniciar(conexion){
    return new Promise((res,rej)=>conexion.beginTransaction(e=>e?rej(e):res(),'quitar_promos'));
}
function confirmar(conexion){
    return new Promise((res,rej)=>conexion.commitTransaction(e=>e?rej(e):res()));
}
function revertir(conexion){
    /////no se propaga el error del rollback: ya estamos en el camino de fallo
    return new Promise((res)=>conexion.rollbackTransaction(()=>res()));
}

let remover_promociones = async (resolve,reject,conexion,galleta,documento,items)=>{
    const codven = galleta ? galleta.codigo : null;

    if(!documento || !codven || !Array.isArray(items) || items.length===0){
        conexion.close();
        return reject("coti desconocida");
    }

    let abierta=false;
    try{
        await iniciar(conexion);
        abierta=true;

        /////1) la cotizacion debe existir, ser de este vendedor y seguir abierta.
        /////   flag/estado se comparan como texto: hay cotizaciones con flag='*' y
        /////   compararlas contra un numero fuerza una conversion que revienta.
        const duenio = await ejecutar(conexion,
            "select ndocu from mst01cot with (updlock) where ndocu=@coti and codven_usu=@codven and flag='0' and estado='0'",
            [{nombre:'coti',tipo:TYPES.VarChar,valor:documento},
             {nombre:'codven',tipo:TYPES.VarChar,valor:codven}]);

        if(duenio.rows.length===0){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("coti no modificable");
        }

        /////2) borrar SOLO lineas de promocion: el endpoint quita promociones, no productos
        const marcadores = items.map((_,i)=>"@i"+i).join(",");
        const params = [{nombre:'doc',tipo:TYPES.VarChar,valor:documento},
                        {nombre:'sku',tipo:TYPES.VarChar,valor:SKU_DESCUENTO},
                        {nombre:'bon',tipo:TYPES.VarChar,valor:MARCA_BONIFICACION}];
        items.forEach((it,i)=>params.push({nombre:'i'+i,tipo:TYPES.Int,valor:it}));

        const borradas = await ejecutarContando(conexion,
            "delete from dtl01cot where ndocu=@doc and item in("+marcadores+") "+
            "and (codi=@sku or LEFT(descr,11)=@bon)", params);

        if(borradas===0){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("promocion no registrada");
        }

        /////3) el descuento de flete es unico en su tipo y se re-evalua aparte, asi que
        /////   se retira siempre que se toquen las promociones
        await ejecutar(conexion,
            "delete from dtl01cot where ndocu=@doc and codi=@sku and LEFT(descr,27)=@flete",
            [{nombre:'doc',tipo:TYPES.VarChar,valor:documento},
             {nombre:'sku',tipo:TYPES.VarChar,valor:SKU_DESCUENTO},
             {nombre:'flete',tipo:TYPES.VarChar,valor:MARCA_FLETE}]);

        /////4) recalcular la cabecera desde el detalle. La suma va en un SELECT aparte
        /////   a proposito: con subconsultas dentro del UPDATE, el rowCount que devuelve
        /////   tedious viene de las subconsultas y da 1 aunque no se actualice nada,
        /////   con lo cual la verificacion del paso 5 seria inutil.
        const suma = await ejecutar(conexion,
            "select ISNULL(SUM(tota),0) as tota from dtl01cot where ndocu=@coti",
            [{nombre:'coti',tipo:TYPES.VarChar,valor:documento}]);

        const tota = Number(suma.rows[0][0].value);

        /////Misma formula que el ERP usa en el trigger trg_mst01cot_Promo:
        /////   toti = SUM(tota)*0.18   y   totn = SUM(tota)*1.18
        const toti = Number((tota * IGV).toFixed(2));
        const totn = Number((tota * CON_IGV).toFixed(2));

        const cabecera = await ejecutarContando(conexion,
            "update mst01cot set tota=@tota, toti=@toti, totn=@totn "+
            "where ndocu=@coti and flag='0' and estado='0'",
            [{nombre:'tota',tipo:TYPES.Float,valor:tota},
             {nombre:'toti',tipo:TYPES.Float,valor:toti},
             {nombre:'totn',tipo:TYPES.Float,valor:totn},
             {nombre:'coti',tipo:TYPES.VarChar,valor:documento}]);

        /////5) si la cabecera no se actualizo, no se confirma nada: antes respondia
        /////   "removido con exito" aunque no hubiera tocado la cotizacion
        if(cabecera===0){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("coti no modificable");
        }

        await confirmar(conexion); abierta=false;
        conexion.close();
        resolve({removidas:borradas, documento:documento});
    }
    catch(err){
        console.error('[promocion] fallo al remover promociones de',documento,err);
        if(abierta){ try{ await revertir(conexion); }catch(e){} }
        try{ conexion.close(); }catch(e){}
        reject("error query");
    }
}

module.exports={remover_promociones}
