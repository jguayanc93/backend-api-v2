const {Request,TYPES} = require('../../conexion/cadena');

/////Cambia el almacen de un pedido, en una sola conexion y dentro de una transaccion.
/////
/////A diferencia de la cotizacion, aqui el codigo de almacen vive en DOS sitios: en cada
/////linea del detalle y tambien en la cabecera. En los 9 284 pedidos de los ultimos 90
/////dias los dos coinciden siempre, asi que tocar solo uno los dejaria descuadrados.
/////
/////El almacen se comprueba contra tbl01alm en vez de aceptar cualquier texto: un codigo
/////inventado pasaria el UPDATE sin error y dejaria el pedido apuntando a la nada.

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
/////el rowCount de tedious cuenta result sets, no filas afectadas: el unico valor
/////confiable es @@ROWCOUNT pedido explicitamente
function ejecutarContando(conexion, sql, parametros){
    return ejecutar(conexion, sql+"; select @@ROWCOUNT as afectadas;", parametros)
        .then(r => (r.rows.length ? Number(r.rows[0][0].value) : 0));
}
function iniciar(conexion){
    return new Promise((res,rej)=>conexion.beginTransaction(e=>e?rej(e):res(),'almacen_pedido'));
}
function confirmar(conexion){
    return new Promise((res,rej)=>conexion.commitTransaction(e=>e?rej(e):res()));
}
function revertir(conexion){
    /////no se propaga el error del rollback: ya estamos en el camino de fallo
    return new Promise((res)=>conexion.rollbackTransaction(()=>res()));
}

let cambiar_almacen = async (resolve,reject,conexion,galleta,cuerpo)=>{
    const codven = galleta ? galleta.codigo : null;
    const npedi  = String((cuerpo && cuerpo.npedi) || '').trim();
    const alm    = String((cuerpo && cuerpo.alm) || '').trim();

    if(!codven){ conexion.close(); return reject("falsa galleta"); }
    if(!npedi){  conexion.close(); return reject("pedido desconocido"); }
    if(!alm){    conexion.close(); return reject("almacen invalido"); }

    let abierta=false;
    try{
        await iniciar(conexion);
        abierta=true;

        /////1) el almacen tiene que existir y estar activo
        const existe = await ejecutar(conexion,
            "select codalm from tbl01alm where codalm=@alm and estado=1",
            [{nombre:'alm',tipo:TYPES.VarChar,valor:alm}]);

        if(existe.rows.length===0){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("almacen invalido");
        }

        /////2) el pedido tiene que ser de este vendedor y no estar atendido ni anulado.
        /////   flag se compara como texto: los anulados tienen flag='*' y convertirlo a
        /////   numero revienta la consulta.
        const duenio = await ejecutar(conexion,
            "select ndocu from mst01ped with (updlock) where ndocu=@doc and codven_usu=@codven and flag='0'",
            [{nombre:'doc',tipo:TYPES.VarChar,valor:npedi},
             {nombre:'codven',tipo:TYPES.VarChar,valor:codven}]);

        if(duenio.rows.length===0){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("pedido no modificable");
        }

        /////3) el detalle
        const lineas = await ejecutarContando(conexion,
            "update dtl01ped set codalm=@alm where ndocu=@doc",
            [{nombre:'alm',tipo:TYPES.VarChar,valor:alm},
             {nombre:'doc',tipo:TYPES.VarChar,valor:npedi}]);

        if(lineas === 0){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("pedido sin detalle");
        }

        /////4) y la cabecera, para que no queden descuadradas
        const cabecera = await ejecutarContando(conexion,
            "update mst01ped set codalm=@alm where ndocu=@doc and flag='0'",
            [{nombre:'alm',tipo:TYPES.VarChar,valor:alm},
             {nombre:'doc',tipo:TYPES.VarChar,valor:npedi}]);

        if(cabecera === 0){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("pedido no modificable");
        }

        await confirmar(conexion); abierta=false;
        conexion.close();
        resolve({documento:npedi, almacen:alm, lineas:lineas});
    }
    catch(err){
        console.error("[cambiar_almacen pedido]",err);
        if(abierta) await revertir(conexion);
        conexion.close();
        reject("error query");
    }
}

module.exports={cambiar_almacen}
