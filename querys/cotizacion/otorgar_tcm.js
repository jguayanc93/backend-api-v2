require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')

/////Graba el tipo de cambio mercado de la cotizacion.
/////
/////Estaba fijo en 3.37 desde el 7 de septiembre, puesto "temporalmente". Ahora llega
/////el del dia, que ya se consulta al principio de /pegar y no se usaba: es tbl01tca.tcmer,
/////la cuarta columna de esa consulta.
/////
/////Si no hubiera tipo de cambio cargado para hoy se deja la cotizacion sin tocar antes
/////que escribir un numero inventado.
let cotizacion_registrar_tcm = (resolve,reject,conexion,galleta,documento,tcmer)=>{

    const cambio = Number(tcmer);
    if(!isFinite(cambio) || cambio <= 0){
        conexion.close();
        return reject("tipcambio no registrado");
    }

    // let vendedor = galleta.codigo;

    let sq_sql="update mst01cot set tcme=@tcme where ndocu=@doc";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();

            resolve("recursion completa");
        }
    })    
    // consulta.addParameter('codven',TYPES.VarChar,vendedor);
    consulta.addParameter('tcme',TYPES.VarChar,String(cambio));
    consulta.addParameter('doc',TYPES.VarChar,documento);
    conexion.execSql(consulta);
}

module.exports={cotizacion_registrar_tcm}