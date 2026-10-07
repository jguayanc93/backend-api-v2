require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')
const {normalizarFecha} = require('../../funciones/comunes/constantes')

/////Forma comun de las tres listas (cotizaciones, facturas, pedidos):
/////  0 fecha · 1 numero con serie · 2 razon social · 3 monto con IGV · 4 moneda
/////  5 registrado con hora · 6 estado · 7 editable · 8 tipo de entrega · 9 tipo de documento
/////
/////Las posiciones NO se corren: donde un modulo no tiene el dato llega null. Asi el
/////frontend usa un solo mapa para las tres pantallas.
/////
/////"registrado" sale de FecReg y no de fecha: fecha siempre viene a las 00:00:00, asi
/////que por si sola no sirve para ordenar las del dia.
/////En pedidos llegan 0-6; editable (7) llega null, y 8 y 9 no aplican.
let pedi_dia_elegido = (resolve,reject,conexion,galleta,body)=>{

    let vendedor= galleta.codigo;

    let desde = normalizarFecha(body ? (body.desde || body.dia) : null);
    let hasta = normalizarFecha(body ? (body.hasta || body.dia) : null);
    if(!desde || !hasta){
        conexion.close();
        return reject("fecha invalida");
    }
    if(desde > hasta){ const tmp=desde; desde=hasta; hasta=tmp; }

    let sq_sql="select CONVERT(varchar,fecha,111),ndocu,nomcli,totn,mone,CONVERT(varchar,FecReg,120),(case flag when '1' then 'atendido' when '0' then 'aprobado' end),CAST(NULL AS varchar(20)) from mst01ped where fecha>=@desde and fecha<DATEADD(day,1,@hasta) and codven_usu=@codven and ISNULL(flag,'')<>'*' order by FecReg desc";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();

            /////sin resultados es una lista vacia, no un error
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
    consulta.addParameter('desde',TYPES.VarChar,desde);
    consulta.addParameter('hasta',TYPES.VarChar,hasta);
    consulta.addParameter('codven',TYPES.VarChar,vendedor);
    conexion.execSql(consulta);
}

module.exports={pedi_dia_elegido}
