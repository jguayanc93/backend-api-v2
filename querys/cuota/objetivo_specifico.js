require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')

let cuota_avance_objetivo_especifico = (resolve,reject,conexion,galleta,objformato)=>{

    // let sq_sql="select SUM(CASE mone WHEN 'D' THEN tota WHEN 'S' THEN tota/tcam END) from mst01fac where YEAR(fecha)=YEAR(GETDATE()) AND MONTH(fecha)=MONTH(GETDATE()) AND flag<>'*' AND codvta<>'04' AND codven_usu=@codven";
    let sq_sql="select SUM(CASE a.mone WHEN 'D' THEN a.tota WHEN 'S' THEN a.tota/a.tcam END) from dtl01fac a inner join mst01fac b on (b.ndocu=a.ndocu) where YEAR(b.fecha)=YEAR(GETDATE()) AND MONTH(b.fecha)=MONTH(GETDATE()) AND b.flag<>'*' AND b.codven_usu=@codven AND LEFT(a.codi,2)=@codfam";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();
            
            if(rows.length==0){
                reject("ninguna venta");
            }
            else{
                let respuesta=[];                
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
                
                /////SUM() devuelve null cuando el vendedor no tiene ninguna venta de esa
                /////familia en el mes. Antes se llamaba .toFixed() sobre null y el
                /////TypeError tumbaba el proceso entero, no solo la peticion.
                const bruto = respuesta[0] ? respuesta[0][0] : null;
                resolve( bruto == null ? 0 : Number(Number(bruto).toFixed(3)) );
            }
        }
    })
    consulta.addParameter('codven',TYPES.VarChar,galleta.codigo);
    consulta.addParameter('codfam',TYPES.VarChar,objformato["codfam"]);
    conexion.execSql(consulta);
}

module.exports={cuota_avance_objetivo_especifico}