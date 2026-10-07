require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')

let promo_buscador_simple = (resolve,reject,conexion,respuesta2)=>{
    let codi_recolector=[];

    let items=respuesta2.productos;

    for(let codi in items){ codi_recolector.push(items[codi]["codigo"]); }
    
    /////sin items no hay nada que buscar; antes se armaba un IN () invalido
    if(codi_recolector.length===0){
        conexion.close();
        reject("ninguna promocion");
        return;
    }

    /////marcadores parametrizados: los codigos vienen del request, no se concatenan
    let marcadores=codi_recolector.map((_,i)=>"@c"+i).join(",");
    let sp_sql="select a.idprom,b.codi from mst_promocion a join dtl_promocion_progra b on b.idprom=a.idprom where a.estado=1 AND b.codi in("+marcadores+") group by a.idprom,b.codi";

    let consulta = new Request(sp_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
            // res.status(401).send("error interno"); 
        }
        else{

            conexion.close();

            if(rows.length==0){
                reject("ninguna promocion")
                // res.status(401).send("no promo");
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
                resolve(respuesta);
            }
        }
    })
    codi_recolector.forEach((c,i)=>consulta.addParameter("c"+i,TYPES.VarChar,c));
    conexion.execSql(consulta);
}

module.exports={promo_buscador_simple}