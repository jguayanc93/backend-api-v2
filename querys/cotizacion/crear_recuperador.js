require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')

let recuperar_detallado = (resolve,reject,conexion,objtotal)=>{
    let contador=0;
    const manejador={};
    let orden=[];
    for(let indice in objtotal){
        ////captura todas los codis
        orden.push(objtotal[indice]["codigo"]);
    }
    detallado_bucle(resolve,reject,conexion,manejador,objtotal,orden,contador);
}

let detallado_bucle =(resolve,reject,conexion,manejador,objtotal,orden,contadorr)=>{
    if(Object.keys(objtotal).length<=contadorr){
        conexion.close();
        resolve(manejador);
    }
    else{
        let sq_sql="select codi,codf,marc,Usr_005,descr,'totn',pcus from prd0101 where codi=@codi";
        let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
            if(err){
                conexion.close();reject("error query");
            }
            else{
                /////se devuelve la conexion antes de rechazar: sin este close() cada codigo
                /////inexistente dejaba una conexion tomada para siempre, y con 10 el pool se
                /////agotaba y todo el backend esperaba 20 s y fallaba
                if(rows.length==0){ conexion.close(); reject("codigo no existe"); }
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
                    manejador[orden[contadorr]] = respuesta[0];
                    detallado_bucle(resolve,reject,conexion,manejador,objtotal,orden,contadorr+1);
                }
            }
        })
        consulta.addParameter('codi',TYPES.Char,orden[contadorr]);
        conexion.execSql(consulta);
    }
}

module.exports={recuperar_detallado}