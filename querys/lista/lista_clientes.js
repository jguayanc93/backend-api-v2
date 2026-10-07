require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')

/////Los clientes del vendedor. El campo 'tipo' decide la vista:
/////  'cartera'   -> sus clientes asignados, con facturas y notas de credito del mes
/////  'cobertura' -> los que facturo este mes SIN tenerlos asignados
/////Cualquier otro valor devuelve lista vacia.
let seleccion_clientes = (resolve,reject,conexion,galleta,body)=>{

    let vendedor= galleta.codigo;
    let eleccion=body.tipo;

    let sq_sql="jc_lista_clientes";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();
            
            /////sin clientes es una lista vacia, no un error: igual que las listas de
            /////cotizaciones, facturas y pedidos. El procedimiento solo mira el mes en
            /////curso, asi que el dia 1 sale vacia para todos hasta la primera factura.
            {
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
    consulta.addParameter('codven',TYPES.VarChar,vendedor);
    consulta.addParameter('lista',TYPES.VarChar,eleccion);
    conexion.callProcedure(consulta);
}

module.exports={seleccion_clientes}