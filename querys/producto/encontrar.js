require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')

let producto_encontrado = (resolve,reject,conexion,req,next)=>{

    let sugerencia=req.body.sugerencia;
    let cctl = req.body.cctl;
    let ccli = req.body.ccli;

    /////'stoc' es el disponible del almacen 01: stoc - (svta + pedi), como en /producto/buscar
    let sq_sql="select a.aigv,'item',a.codi,a.codf,a.marc,a.umed,a.descr,(CAST(ISNULL(a.stoc,0) as int)-(CAST(ISNULL(a.svta,0) as int)+CAST(ISNULL(a.pedi,0) as int))) as 'stoc',a.vvus,b.dscto_maxven,a.pcus,a.msto from prd0101 a join dtl_dscto_marca_tc b on (b.codmar=a.codmar) join mst01cli c on (c.tipocl=b.codtcl) where a.estado=1 and a.codi=@pista and b.codtcl=@alfabeto and c.codcli=@cliente";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();

            ////////lo mandara aqui porqe aunque si exista no esta registrado en la intranet y debe registrarse
            if(rows.length==0){
                reject("producto no registrado");
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
                resolve(respuesta2[0]);
            }
        }
    })    
    consulta.addParameter('pista',TYPES.VarChar,sugerencia);
    consulta.addParameter('alfabeto',TYPES.VarChar,cctl);
    consulta.addParameter('cliente',TYPES.VarChar,ccli)
    conexion.execSql(consulta);
}

module.exports={producto_encontrado}