const {Request,TYPES} = require('../../conexion/cadena')

/////Antes se lanzaba un DELETE por item (N+1). Ahora es uno solo con IN parametrizado.
let removido_items_bucle = (resolve,reject,conexion,body)=>{

    const filas = body.removeproms || [];
    if(filas.length === 0){
        conexion.close();
        resolve("desacoplamiento exitoso");
        return;
    }

    const documento = filas[0][0];
    const items = filas.map(f => f[1]);

    const marcadores = items.map((_,i)=>"@i"+i).join(",");
    let sq_sql="delete from dtl01cot where ndocu=@doc AND item in("+marcadores+")";

    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            console.error('[promocion] fallo al remover items de promocion',err);
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();
            resolve("desacoplamiento exitoso");
        }
    })
    consulta.addParameter('doc',TYPES.Char,documento);
    items.forEach((it,i)=>consulta.addParameter("i"+i,TYPES.Int,it));
    conexion.execSql(consulta);
}

module.exports={removido_items_bucle}
