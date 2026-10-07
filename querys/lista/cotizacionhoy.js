require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')

/////Forma comun de las tres listas (cotizaciones, facturas, pedidos):
/////  0 fecha · 1 numero con serie · 2 razon social · 3 monto con IGV · 4 moneda
/////  5 registrado con hora · 6 estado · 7 editable · 8 tipo de entrega · 9 tipo de documento
/////
/////Las posiciones NO se corren: donde un modulo no tiene el dato llega null. Asi el
/////frontend usa un solo mapa para las tres pantallas.
/////
/////"registrado" sale de FecReg y no de fecha: fecha siempre viene a las 00:00:00, asi
/////que por si sola no sirve para ordenar las del dia.
/////En cotizaciones llegan 0-7; 8 y 9 no aplican.
let coti_de_hoy = (resolve,reject,conexion,galleta)=>{

    let vendedor= galleta.codigo;

    /////el rango del dia comparado contra la columna sin envolverla en funciones: asi puede
    /////usar el indice. Antes YEAR()+MONTH()+DAY() obligaba a recorrer mst01cot entera.
    let sq_sql="select CONVERT(varchar,fecha,111),ndocu,nomcli,totn,mone,CONVERT(varchar,FecReg,120),(case cdge when '' then 'cotizado' when '01' then 'facturado' when '03' then 'boleta' when '32' then 'pedido' end),(case when flag='0' and estado='0' then 1 else 0 end) from mst01cot where fecha>=CAST(GETDATE() as date) and fecha<DATEADD(day,1,CAST(GETDATE() as date)) and codven_usu=@codven and ISNULL(flag,'')<>'*' order by FecReg desc";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();

            /////un dia sin cotizaciones es una lista vacia, no un error: antes rechazaba y el
            /////vendedor que todavia no cotizo veia "cotizacion inexistente"
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
    })
    consulta.addParameter('codven',TYPES.VarChar,vendedor);
    conexion.execSql(consulta);
}

module.exports={coti_de_hoy}
