require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')


let removeflete =(resolve,reject,conexion,documento)=>{

    let sq_sql="delete from dtl01cot where ndocu=@doc AND codi='0303-010001' AND LEFT(descr,27)='DSCTO/PROM: FLETE PROVINCIA'";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();
            resolve("retirado")
        }
    })
    consulta.addParameter('doc',TYPES.Char,documento);
    conexion.execSql(consulta);
}

module.exports={removeflete}