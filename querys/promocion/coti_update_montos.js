require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')

/////flag se compara como TEXTO a proposito: las cotizaciones eliminadas tienen
/////flag='*', y compararlo contra un numero fuerza una conversion que revienta con
/////"Conversion failed when converting the varchar value '*' to data type int".

let coti_update_montos = (resolve,reject,conexion,fullpromo)=>{

    let sq_sql="update mst01cot set tota=@tota,toti=@toti,totn=@totn where ndocu=@ncoti and flag='0' and estado='0'";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();

            delete fullpromo["descuento"];
            resolve("corregido");
        }
    })
    consulta.addParameter('tota',TYPES.VarChar,fullpromo["descuento"][1].toFixed(2));
    consulta.addParameter('toti',TYPES.VarChar,fullpromo["descuento"][2].toFixed(2));
    consulta.addParameter('totn',TYPES.VarChar,fullpromo["descuento"][3].toFixed(2));
    consulta.addParameter('ncoti',TYPES.VarChar,fullpromo["descuento"][0]);
    conexion.execSql(consulta);
}

module.exports={coti_update_montos}