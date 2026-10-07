require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')
const {resolverNdocu} = require('../../funciones/comunes/constantes')

/////El detalle de una cotizacion del vendedor que la pide.
/////
/////El filtro por codven_usu va dentro de esta misma consulta y no en una previa: asi no
/////cuesta una segunda ida a la base, y no hay forma de que la cotizacion se entregue
/////antes de comprobar de quien es. Sin ese filtro cualquier usuario autenticado podia
/////leer la cotizacion de otro tecleando su numero.
/////
/////flag se compara como texto porque las eliminadas tienen flag='*' y convertirlo a
/////numero revienta. Se aceptan las facturadas y pedidos (flag='1'): reimprimir el PDF de
/////una cotizacion ya facturada es un caso normal. Solo se excluyen las eliminadas.
let coti_ver = (resolve,reject,conexion,req,galleta)=>{

    let numero= req.body.ncoti;
    let ncoti= resolverNdocu(numero);   ////acepta el ndocu completo (009- o 098-) o el numero suelto
    let codven= galleta.codigo;

    // let sq_sql="select b.tipocl,a.fecha,a.cdocu,a.ndocu,a.codcli,a.tcam,a.mone,a.moneitm,a.aigv,'item',a.codi,a.codf,a.marc,a.umed,a.descr,a.cant,a.preu,a.tota,a.dsct,a.totn,a.codalm,a.cost,a.msto from dtl01cot a inner join mst01cli b on (b.codcli=a.codcli) inner join mst01cot c on (c.ndocu=a.ndocu) where a.ndocu=@coti AND c.flag='0' AND LEFT(a.codi,4)<>'0303' AND LEFT(a.descr,11)<>'GRATIS/PROM' order by a.item";
    let sq_sql="select b.tipocl,a.fecha,a.cdocu,a.ndocu,a.codcli,a.tcam,a.mone,a.moneitm,a.aigv,'item',a.codi,a.codf,a.marc,a.umed,a.descr,a.cant,a.preu,a.tota,a.dsct,a.totn,a.codalm,a.cost,a.msto,c.nomcli,b.dircli,c.atte from dtl01cot a inner join mst01cli b on (b.codcli=a.codcli) inner join mst01cot c on (c.ndocu=a.ndocu) where a.ndocu=@coti AND ISNULL(c.flag,'')<>'*' AND c.codven_usu=@codven order by a.item";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();

            /////sin filas puede ser que no exista, que este eliminada o que sea de otro
            /////vendedor; se responden igual a proposito, para no confirmar que un numero
            /////ajeno existe
            if(rows.length==0){
                reject("coti desconocida");
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

module.exports={coti_ver}
