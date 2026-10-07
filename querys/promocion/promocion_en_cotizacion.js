require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')
const {resolverNdocu} = require('../../funciones/comunes/constantes')

let coti_contiene_promocion = (resolve,reject,conexion,cuerpo,promocion)=>{
    
    let ncoti= resolverNdocu(cuerpo.ncoti);   ////acepta el ndocu completo (009- o 098-) o el numero suelto
    let nomprom = "%"+promocion[1]+"%";
    let idprom = "%"+"#"+promocion[0]+"%";

    let sq_sql="select ndocu,descr from dtl01cot where ndocu=@ndoc and (descr like @nomprom OR descr like @idprom)";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();
            
            if(rows.length==0){
                resolve("next");
                // next();
            }
            else{
                reject("promo ya aplicada");
            }
        }
    })
    consulta.addParameter('ndoc',TYPES.VarChar,ncoti);
    consulta.addParameter('nomprom',TYPES.VarChar,nomprom);
    consulta.addParameter('idprom',TYPES.VarChar,idprom);
    conexion.execSql(consulta);
}

module.exports={coti_contiene_promocion}