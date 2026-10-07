require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')
const {resolverNdocu} = require('../../funciones/comunes/constantes')

/////El detalle de la cotizacion, para saber que promociones le aplican.
/////
/////Antes leia dtl01cot por numero y nada mas: cualquiera con sesion podia preguntar por
/////la cotizacion de otro vendedor. Ahora entra por la cabecera, que es donde esta el dueño.
let promo_vertodo = (resolve,reject,conexion,cuerpo,galleta)=>{

    let codven = galleta ? galleta.codigo : null;

    let numero= cuerpo.ncoti;
    let ncoti= resolverNdocu(numero);   ////acepta el ndocu completo (009- o 098-) o el numero suelto

    let sq_sql="select CONVERT(varchar,a.fecha,120) as fecha,a.cdocu,a.ndocu,a.codcli,a.tcam,a.mone,a.moneitm,a.aigv,a.item,a.codi,a.codf,a.marc,a.umed,a.descr,a.cant,a.preu,a.tota,a.dsct,a.totn,a.codalm,a.cost,a.msto,a.ucon,a.ucom,a.obse from dtl01cot a inner join mst01cot c on (c.ndocu=a.ndocu) where a.ndocu=@coti and c.codven_usu=@codven order by a.item";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();
            
            if(rows.length==0){
                reject("cotizacion no registrada");
            }
            else{
                let respuesta=[];
                let respuesta2={};
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
                Object.assign(respuesta2,respuesta);
                resolve(respuesta2);
            }
        }
    })
    consulta.addParameter('coti',TYPES.VarChar,ncoti);
    consulta.addParameter('codven',TYPES.VarChar,codven);
    conexion.execSql(consulta);
}

module.exports={promo_vertodo}