const {Request,TYPES} = require('../../conexion/cadena');

/////Registra la cuota del vendedor para el mes en curso. UNA sola vez al mes.
/////
/////Antes era un INSERT a secas: nada impedia registrar dos veces. Que hoy no haya
/////duplicados en la tabla es porque la pantalla llama a /cuota/revisar antes y se
/////autolimita, pero un segundo POST -o dos pestañas abiertas- metia la segunda fila.
/////Y con dos metas del mismo mes, la consulta del avance se queda con la primera que
/////devuelva SQL Server, que no esta garantizada.
/////
/////La comprobacion y la insercion van en una transaccion, con el bloqueo tomado al
/////leer: si llegan dos peticiones a la vez, la segunda espera y encuentra la fila.

function ejecutar(conexion, sql, parametros){
    return new Promise((resolve,reject)=>{
        const consulta = new Request(sql,(err,rowCount,rows)=>{
            if(err) return reject(err);
            resolve(rows||[]);
        });
        (parametros||[]).forEach(p=>consulta.addParameter(p.nombre,p.tipo,p.valor));
        conexion.execSql(consulta);
    });
}
/////el rowCount de tedious cuenta result sets, no filas afectadas
function ejecutarContando(conexion, sql, parametros){
    return ejecutar(conexion, sql+"; select @@ROWCOUNT as afectadas;", parametros)
        .then(r => (r.length ? Number(r[0][0].value) : 0));
}
function iniciar(conexion){
    return new Promise((res,rej)=>conexion.beginTransaction(e=>e?rej(e):res(),'registrar_cuota'));
}
function confirmar(conexion){
    return new Promise((res,rej)=>conexion.commitTransaction(e=>e?rej(e):res()));
}
function revertir(conexion){
    return new Promise((res)=>conexion.rollbackTransaction(()=>res()));
}

const YA_EXISTE =
    "select monto from tbl_api_vendedores_meta with (updlock, holdlock)"+
    " where codven=@codusu and anno=YEAR(GETDATE()) and mes=MONTH(GETDATE())";

const INSERTAR =
    "INSERT INTO tbl_api_vendedores_meta(codven,anno,mes,monto,volumen,cobertura,diferenciador,family,obj_espc)"+
    " VALUES(@codusu,YEAR(GETDATE()),MONTH(GETDATE()),@cuota,50,50,@diferenciador,@family,@porcentaje)";

let registro_cuota = async (resolve,reject,conexion,galleta,diferenciador,body,codfam)=>{
    const codusu = galleta ? galleta.identificador : null;
    const cuota = Number(body ? body.fijado : NaN);
    const porcentaje = Number(body ? body.porcentaje : 0);

    if(!codusu){ conexion.close(); return reject("falsa galleta"); }
    if(!isFinite(cuota) || cuota <= 0){
        conexion.close();
        return reject("cuota invalida");
    }

    let abierta=false;
    try{
        await iniciar(conexion);
        abierta=true;

        const existe = await ejecutar(conexion, YA_EXISTE,
            [{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu}]);

        if(existe.length > 0){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("cuota ya registrada");
        }

        const filas = await ejecutarContando(conexion, INSERTAR,
            [{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu},
             {nombre:'cuota',tipo:TYPES.Float,valor:cuota},
             {nombre:'diferenciador',tipo:TYPES.VarChar,valor:diferenciador},
             {nombre:'family',tipo:TYPES.VarChar,valor:codfam},
             {nombre:'porcentaje',tipo:TYPES.Float,valor:isFinite(porcentaje)?porcentaje:0}]);

        if(filas === 0){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("error query");
        }

        await confirmar(conexion); abierta=false;
        conexion.close();
        resolve({registrado:true, cuota:cuota, family:codfam, objetivo:porcentaje});
    }
    catch(err){
        console.error("[registro_cuota]",err);
        if(abierta) await revertir(conexion);
        conexion.close();
        reject("error query");
    }
}

module.exports={registro_cuota}
