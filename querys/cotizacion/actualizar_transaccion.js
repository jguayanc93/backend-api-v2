const {Request,TYPES} = require('../../conexion/cadena');
const {IGV, CON_IGV} = require('../../funciones/comunes/constantes');

/////Reescribe el detalle de una cotizacion en UNA sola conexion y dentro de una
/////transaccion.
/////
/////Antes esto eran 3 conexiones sueltas: borrar el detalle, actualizar la cabecera y
/////volver a insertar las lineas. Si fallaba despues del borrado, la cotizacion quedaba
/////sin lineas y con los montos nuevos en la cabecera. El borrado es un
/////"delete from dtl01cot where ndocu=@doc", asi que no habia nada que recuperar.
/////
/////La cabecera se recalcula al final, sumando el detalle ya escrito, en vez de confiar
/////en los totales que vienen en el cuerpo. Es la misma regla que usan /acoplar y
//////eliminar, y la misma formula que aplica el trigger del ERP: toti = tota * 0.18.

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
/////OJO: el rowCount de tedious cuenta result sets, no filas afectadas. El unico valor
/////confiable es @@ROWCOUNT pedido explicitamente.
function ejecutarContando(conexion, sql, parametros){
    return ejecutar(conexion, sql+"; select @@ROWCOUNT as afectadas;", parametros)
        .then(r => (r.rows.length ? Number(r.rows[0][0].value) : 0));
}
function grabarLinea(conexion, linea){
    return new Promise((resolve,reject)=>{
        const consulta = new Request("GrabaDTLCotFac",(err)=>err?reject(err):resolve());
        consulta.addParameter('fecha',TYPES.DateTime,linea[0]);
        consulta.addParameter('cdocu',TYPES.Char,linea[1]);
        consulta.addParameter('ndocu',TYPES.Char,linea[2]);
        consulta.addParameter('codcli',TYPES.Char,linea[3]);
        consulta.addParameter('tcam',TYPES.Float,linea[4]);
        consulta.addParameter('mone',TYPES.Char,linea[5]);
        consulta.addParameter('moneitm',TYPES.Char,linea[6]);
        consulta.addParameter('aigv',TYPES.Char,linea[7]);
        consulta.addParameter('item',TYPES.Float,linea[8]);
        consulta.addParameter('codi',TYPES.Char,linea[9]);
        consulta.addParameter('codf',TYPES.Char,linea[10]);
        consulta.addParameter('marc',TYPES.Char,linea[11]);
        consulta.addParameter('umed',TYPES.Char,linea[12]);
        consulta.addParameter('descr',TYPES.Char,linea[13]);
        consulta.addParameter('cant',TYPES.Float,linea[14]);
        consulta.addParameter('preu',TYPES.Float,linea[15]);
        consulta.addParameter('tota',TYPES.Float,linea[16]);
        consulta.addParameter('dsct',TYPES.Float,linea[17]);
        consulta.addParameter('totn',TYPES.Float,linea[18]);
        consulta.addParameter('AnulaDetalle',TYPES.Char,'');
        consulta.addParameter('codalm',TYPES.Char,linea[19]);
        consulta.addParameter('cost',TYPES.Float,linea[20]);
        consulta.addParameter('msto',TYPES.Char,linea[21]);
        conexion.callProcedure(consulta);
    });
}
function iniciar(conexion){
    return new Promise((res,rej)=>conexion.beginTransaction(e=>e?rej(e):res(),'actualizar_coti'));
}
function confirmar(conexion){
    return new Promise((res,rej)=>conexion.commitTransaction(e=>e?rej(e):res()));
}
function revertir(conexion){
    /////no se propaga el error del rollback: ya estamos en el camino de fallo
    return new Promise((res)=>conexion.rollbackTransaction(()=>res()));
}

let actualizar_cotizacion = async (resolve,reject,conexion,galleta,documento,lineas)=>{
    const codven = galleta ? galleta.codigo : null;
    const orden = [];
    for(const indice in lineas){ orden.push(lineas[indice]); }

    if(!codven || !documento || orden.length===0){
        conexion.close();
        return reject("coti desconocida");
    }

    let abierta=false;
    try{
        await iniciar(conexion);
        abierta=true;

        /////1) debe existir, ser de este vendedor y seguir abierta.
        /////   flag y estado se comparan como texto: las anuladas tienen flag='*' y
        /////   convertirlo a numero revienta la consulta.
        const duenio = await ejecutar(conexion,
            "select ndocu from mst01cot with (updlock) where ndocu=@coti and codven_usu=@codven and flag='0' and estado='0'",
            [{nombre:'coti',tipo:TYPES.VarChar,valor:documento},
             {nombre:'codven',tipo:TYPES.VarChar,valor:codven}]);

        if(duenio.rows.length===0){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("coti no modificable");
        }

        /////2) fuera el detalle viejo
        await ejecutarContando(conexion,
            "delete from dtl01cot where ndocu=@doc",
            [{nombre:'doc',tipo:TYPES.VarChar,valor:documento}]);

        /////3) las lineas nuevas, una por una, con el procedimiento del ERP
        for(const linea of orden){ await grabarLinea(conexion,linea); }

        /////4) la cabecera sale del detalle recien escrito, no del cuerpo de la peticion
        const suma = await ejecutar(conexion,
            "select ISNULL(SUM(tota),0) as tota from dtl01cot where ndocu=@doc",
            [{nombre:'doc',tipo:TYPES.VarChar,valor:documento}]);

        const tota = Number(Number(suma.rows[0][0].value).toFixed(2));
        const toti = Number((tota * IGV).toFixed(2));
        const totn = Number((tota * CON_IGV).toFixed(2));

        const cabecera = await ejecutarContando(conexion,
            "update mst01cot set tota=@tota, toti=@toti, totn=@totn where ndocu=@doc and flag='0' and estado='0'",
            [{nombre:'tota',tipo:TYPES.Float,valor:tota},
             {nombre:'toti',tipo:TYPES.Float,valor:toti},
             {nombre:'totn',tipo:TYPES.Float,valor:totn},
             {nombre:'doc',tipo:TYPES.VarChar,valor:documento}]);

        if(cabecera === 0){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("coti no modificable");
        }

        await confirmar(conexion); abierta=false;
        conexion.close();
        resolve({documento:documento, lineas:orden.length, totales:{tota:tota, toti:toti, totn:totn}});
    }
    catch(err){
        console.error("[actualizar_cotizacion]",err);
        if(abierta) await revertir(conexion);
        conexion.close();
        reject("error query");
    }
}

module.exports={actualizar_cotizacion}
