require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')
const {resolverNdocu} = require('../../funciones/comunes/constantes')

/////Cambia el almacen de todas las lineas de una cotizacion.
/////
/////Desde el 18/11/2026:
/////  - el almacen tiene que existir y estar activo en tbl01alm, como en /pedido/almacen;
/////    antes cualquier texto pasaba el UPDATE sin error.
/////  - el UPDATE lleva la propiedad y el flag en su propio WHERE: la comprobacion previa de
/////    almacen.js corre en otra conexion, y entre las dos la cotizacion podia cambiar.
let almacen_corregido = (resolve,reject,conexion,body,galleta)=>{

    let ncoti= resolverNdocu(body ? body.ncoti : null);   ////acepta el ndocu completo (009- o 098-) o el numero suelto
    let alm= String((body && body.alm) || '').trim();
    let codven= galleta ? galleta.codigo : null;

    if(!ncoti || !codven){ conexion.close(); return reject("coti desconocida"); }
    if(!alm){ conexion.close(); return reject("almacen invalido"); }

    let sq_sql=
        "if not exists(select 1 from tbl01alm where codalm=@alm and estado=1) select -1 as afectadas"+
        " else begin"+
        "  update d set d.codalm=@alm from dtl01cot d"+
        "   inner join mst01cot m on (m.cdocu=d.cdocu and m.ndocu=d.ndocu)"+
        "   where m.ndocu=@doc and m.flag='0' and m.codven_usu=@codven;"+
        "  select @@ROWCOUNT as afectadas;"+
        " end";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        conexion.close();
        if(err){
            console.error("[almacen_corregido]",err);
            return reject("error query");
        }
        const afectadas = rows && rows.length ? Number(rows[0][0].value) : 0;
        if(afectadas === -1) return reject("almacen invalido");
        if(afectadas === 0) return reject("coti desconocida");
        resolve("almacen cambiado");
    })
    consulta.addParameter('alm',TYPES.VarChar,alm);
    consulta.addParameter('doc',TYPES.VarChar,ncoti);
    consulta.addParameter('codven',TYPES.VarChar,codven);
    conexion.execSql(consulta);
}

module.exports={almacen_corregido}
