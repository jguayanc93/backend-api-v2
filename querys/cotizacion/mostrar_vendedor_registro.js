require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')
const {resolverNdocu} = require('../../funciones/comunes/constantes')

/////flag se compara como TEXTO a proposito: las cotizaciones eliminadas tienen
/////flag='*', y compararlo contra un numero fuerza una conversion que revienta con
/////"Conversion failed when converting the varchar value '*' to data type int".

let coti_validar_vendedor = (resolve,reject,conexion,galleta,body)=>{

    let codven= galleta.codigo;
    let numero= body.ncoti;
    let ncoti= resolverNdocu(numero);   ////acepta el ndocu completo (009- o 098-) o el numero suelto

    let sq_sql="select * from mst01cot where flag='0' AND ndocu=@coti AND codven_usu=@codven";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();

            ////////lo mandara aqui porqe aunque si exista no esta registrado en la intranet y debe registrarse
            if(rows.length==0){
                reject("coti desconocida");
            }
            else{
                let respuesta=[];
                // let respuesta2={};
                let contador=0;
                rows.forEach(fila=>{
                    let tmp={};
                    fila.map(data=>{
                        if(contador>=fila.length) contador=0;
                        typeof data.value=='string' ? tmp[contador]=data.value.trim() : tmp[contador]=data.value;
                        contador++;
                    })
                    respuesta.push(tmp);
                });
                // Object.assign(respuesta2,respuesta);
                resolve(respuesta[0]);
            }
        }
    })
    consulta.addParameter('coti',TYPES.VarChar,ncoti);
    consulta.addParameter('codven',TYPES.VarChar,codven);
    conexion.execSql(consulta);
}

module.exports={coti_validar_vendedor}