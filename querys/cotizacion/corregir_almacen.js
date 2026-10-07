require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')
const {resolverNdocu} = require('../../funciones/comunes/constantes')

let almacen_corregido = (resolve,reject,conexion,body)=>{

    let numero= body.ncoti;
    let ncoti= resolverNdocu(numero);   ////acepta el ndocu completo (009- o 098-) o el numero suelto

    let alm=body.alm;

    let sq_sql="update dtl01cot set codalm=@alm where ndocu=@doc";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();

            resolve("almacen cambiado");
        }
    })    
    consulta.addParameter('alm',TYPES.VarChar,alm);
    consulta.addParameter('doc',TYPES.VarChar,ncoti);
    conexion.execSql(consulta);
}

module.exports={almacen_corregido}