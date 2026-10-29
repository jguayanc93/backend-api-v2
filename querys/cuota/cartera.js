require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')
const R = require('../zona/regla')

/////Lo que factura el a clientes de cartera, la regla de querys/zona/regla.js. Antes sumaba por
/////codven (el dueño del cliente) y le contaba lo que otros facturaban a sus clientes.
let cuota_avance_cartera = (resolve,reject,conexion,galleta,diferenciador)=>{

    let sq_sql=`select SUM(${R.MONTO('f')}) from mst01fac f where YEAR(f.fecha)=YEAR(GETDATE()) AND MONTH(f.fecha)=MONTH(GETDATE()) AND ${R.VALIDA('f')} AND f.codven_usu=@codven AND ${R.DE_CARTERA('f')}`;
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();
            
            if(rows.length==0){
                reject("cuota no existe");
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
                
                resolve(respuesta[0][0]);
            }
        }
    })
    consulta.addParameter('codven',TYPES.VarChar,galleta.codigo);
    conexion.execSql(consulta);
}

module.exports={cuota_avance_cartera}