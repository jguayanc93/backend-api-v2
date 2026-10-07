require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')
const {conn} = require('../../conexion/cnn')
const {resolverNdocu} = require('../../funciones/comunes/constantes')

let coti_vertodo = (resolve,reject,conexion,cuerpo,galleta)=>{

    let numero= cuerpo.ncoti;
    let ncoti= resolverNdocu(numero);   ////acepta el ndocu completo (009- o 098-) o el numero suelto
    let codven= galleta.codigo;   ////sin este filtro cualquiera leia las promociones de una coti ajena

    // let sq_sql="select a.codf,a.marc,a.descr,a.cant,a.preu,a.totn,a.dsct,a.codalm from dtl01cot a inner join mst01cot b on (b.ndocu=a.ndocu) where b.flag=0 AND a.ndocu=@coti order by item";
    let sq_sql="select b.tipocl,a.fecha,a.cdocu,a.ndocu,a.codcli,a.tcam,a.mone,a.moneitm,a.aigv,a.item,a.codi,a.codf,a.marc,a.umed,a.descr,a.cant,a.preu,a.tota,a.dsct,a.totn,a.codalm,a.cost,a.msto from dtl01cot a inner join mst01cli b on (b.codcli=a.codcli) inner join mst01cot c on (c.ndocu=a.ndocu) where a.ndocu=@coti AND c.flag='0' AND c.estado='0' AND c.codven_usu=@codven AND c.mone='D' AND (a.codi='0303-010001' OR LEFT(a.descr,11)='GRATIS/PROM') AND LEFT(descr,27)<>'DSCTO/PROM: FLETE PROVINCIA' order by a.item";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();

            /////sin filas hay tres motivos distintos y conviene separarlos: la pantalla
            /////no puede explicar "no tiene promociones" si en realidad la cotizacion va
            /////en soles, que es una restriccion de esta ruta y no una ausencia de datos.
            if(rows.length==0){
                return clasificar(reject,ncoti,codven);
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

/////Cuando no hay lineas de promocion, se mira por que: la cotizacion puede no existir,
/////no ser suya, no estar abierta, ir en soles -esta ruta solo entrega dolares- o
/////sencillamente no tener promociones. Antes las cinco respondian lo mismo.
function clasificar(reject, ncoti, codven){
    conn(
        (conexion)=>{
            const consulta = new Request(
                "select LTRIM(RTRIM(mone)) mone, LTRIM(RTRIM(flag)) flag, LTRIM(RTRIM(estado)) estado"+
                " from mst01cot where ndocu=@coti and codven_usu=@codven",
                (err,rowCount,filas)=>{
                    conexion.close();
                    if(err) return reject("error query");
                    if(!filas || filas.length===0) return reject("coti desconocida");
                    const f = filas[0];
                    const mone = String(f[0].value||"").trim();
                    const flag = String(f[1].value||"").trim();
                    const estado = String(f[2].value||"").trim();
                    if(flag!=="0" || estado!=="0") return reject("coti no modificable");
                    if(mone!=="D") return reject("coti en soles");
                    return reject("promocion no tiene");
                });
            consulta.addParameter("coti",TYPES.VarChar,ncoti);
            consulta.addParameter("codven",TYPES.VarChar,codven);
            conexion.execSql(consulta);
        },
        ()=>reject("error query")
    );
}

module.exports={coti_vertodo}