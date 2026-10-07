require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')

let producto_buscar = (resolve,reject,conexion,req,next)=>{

    let tipbusq=req.body.tipbusq;
    let caracter=`%${req.body.sugerencia}%`;
    let letra = req.body.letra;

    let sp_sql;

    if(tipbusq=='1'){        
        // sp_sql="select top 5 a.codi,a.descr,CAST(a.stoc as int) as 'principal',ISNULL(CAST(b.stoc as int),0) as 'm&m',c.dscto_maxven,a.vvus from prd0101 a left join prd0108 b on (b.codi=a.codi) inner join dtl_dscto_marca_tc c on (c.codmar=a.codmar) where a.estado=1 AND CAST(a.vvus as  int)>1 AND c.codtcl=@abecedario and a.descr like @pista order by a.stoc desc";
        sp_sql="select top 5 a.codi,a.descr,CAST(a.stoc as int) as 'principal',ISNULL(CAST(b.stoc as int),0) as 'm&m',c.dscto_maxven,a.vvus,ISNULL(CAST(d.stoc as int),0) as 'piura' from prd0101 a left join prd0108 b on (b.codi=a.codi) left join prd0115 d on (d.codi=a.codi) inner join dtl_dscto_marca_tc c on (c.codmar=a.codmar) where a.estado=1 AND CAST(a.vvus as  int)>1 AND c.codtcl=@abecedario and a.descr like @pista order by a.stoc desc";
    }
    else if(tipbusq=='2'){
        // sp_sql="select top 5 a.codi,a.descr,CAST(a.stoc as int) as 'principal',ISNULL(CAST(b.stoc as int),0) as 'm&m',c.dscto_maxven,a.vvus from prd0101 a left join prd0108 b on (b.codi=a.codi) inner join dtl_dscto_marca_tc c on (c.codmar=a.codmar) where a.estado=1 AND CAST(a.vvus as  int)>1 AND c.codtcl=@abecedario and a.Usr_001 like @pista order by a.stoc desc";
        sp_sql="select top 5 a.codi,a.descr,CAST(a.stoc as int) as 'principal',ISNULL(CAST(b.stoc as int),0) as 'm&m',c.dscto_maxven,a.vvus,ISNULL(CAST(d.stoc as int),0) as 'piura' from prd0101 a left join prd0108 b on (b.codi=a.codi) left join prd0115 d on (d.codi=a.codi) inner join dtl_dscto_marca_tc c on (c.codmar=a.codmar) where a.estado=1 AND CAST(a.vvus as  int)>1 AND c.codtcl=@abecedario and a.Usr_001 like @pista order by a.stoc desc";
    }

    let consulta= new Request(sp_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();
            
            if(rows.length==0){
                reject("producto no similitudes");
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
    consulta.addParameter('abecedario',TYPES.VarChar,letra);
    consulta.addParameter('pista',TYPES.VarChar,caracter);
    conexion.execSql(consulta);
}

module.exports={producto_buscar}