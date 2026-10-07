const {Request,TYPES} = require('../../conexion/cadena')

/////flag se compara como TEXTO a proposito: las cotizaciones eliminadas tienen
/////flag='*', y compararlo contra un numero fuerza una conversion que revienta con
/////"Conversion failed when converting the varchar value '*' to data type int".

/////Comprueba que la cotizacion exista, siga abierta (flag=0) y sea del vendedor
/////que tiene la sesion. Mismo criterio que coti_validar_vendedor de cotizacion,
/////pero recibiendo el ndocu completo en vez de armarlo con el prefijo.
let validar_propiedad = (resolve,reject,conexion,galleta,documento)=>{

    let codven = galleta ? galleta.codigo : null;

    if(!documento || !codven){
        conexion.close();
        reject("coti desconocida");
        return;
    }

    let sq_sql="select ndocu from mst01cot where flag='0' AND estado='0' AND ndocu=@coti AND codven_usu=@codven";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();
            if(rows.length==0){ reject("coti desconocida"); }
            else{ resolve(documento); }
        }
    })
    consulta.addParameter('coti',TYPES.VarChar,documento);
    consulta.addParameter('codven',TYPES.VarChar,codven);
    conexion.execSql(consulta);
}

module.exports={validar_propiedad}
