const {Request,TYPES} = require('../../conexion/cadena');

/////Las cinco listas de opciones de factura comparten forma: {total, data}.
/////
/////El total sale de COUNT(*) OVER (), que se calcula ANTES de aplicar el TOP, asi que
/////dice cuantas opciones hay aunque solo viajen cinco. Sin el, quien busca entre 358
/////transportistas ve cinco y no sabe si el suyo no existe o si hay veinte mas detras.
/////
/////Una lista vacia es una lista vacia, no un error: antes rechazaban con
/////"factura no asignada", que ademas no describe lo que pasa.

/////la ultima columna de cada consulta es el total; el resto son la opcion
function listar(conexion, sql, parametros){
    return new Promise((resolve,reject)=>{
        const consulta = new Request(sql,(err,rowCount,rows)=>{
            if(err){
                console.error("[opciones factura]",err);
                conexion.close();
                return reject("error query");
            }
            conexion.close();

            const filas = rows || [];
            let total = 0;
            const data = {};

            filas.forEach((fila,i)=>{
                const opcion = {};
                let columna = 0;
                fila.forEach(c=>{
                    if(c.metadata.colName === 'total'){ total = Number(c.value); return; }
                    opcion[columna++] = typeof c.value === 'string' ? c.value.trim() : c.value;
                });
                data[i] = opcion;
            });

            resolve({total: filas.length ? total : 0, data: data});
        });
        (parametros||[]).forEach(p=>consulta.addParameter(p.nombre,p.tipo,p.valor));
        conexion.execSql(consulta);
    });
}

/////Atencion y direccion se piden por codigo de cliente. Sin esta condicion, cualquiera
/////con un codcli listaba los contactos de cualquier cliente -nombre y documento de una
/////persona-, sin necesidad de tener una factura suya.
const ES_SU_CLIENTE =
    " and exists(select 1 from mst01fac f where f.codcli=@cliente and f.codven_usu=@codven"+
    " and f.cdocu in ('01','03') and f.flag<>'*')";

const texto = (v)=>"%"+String(v==null?"":v).trim()+"%";

module.exports={listar, ES_SU_CLIENTE, texto, TYPES};
