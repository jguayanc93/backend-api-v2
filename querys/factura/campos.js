const {Request,TYPES} = require('../../conexion/cadena');

/////Los siete campos editables de una factura, de una sola vez.
/////
/////Antes habia que pedirlos de siete en siete, una ruta por campo. El bloque comentado
/////del frontend llamaba a /vendedor/modificar, que no existe en ningun router.
/////
/////Se devuelven con nombre y no por posicion: es una ruta nueva, no arrastra
/////compatibilidad, y una tabla de posiciones mas era justo lo que sobraba en este modulo.
/////
/////Los mismos filtros que usan las siete lecturas de hoy: factura o boleta, no anulada,
/////sin guia emitida, y del vendedor que pregunta.

/////El transportista depende del tipo de despacho: en Lima va el fijo T0001 y en
/////provincia el que tenga la factura. En ventanilla no hay, y llega null.
const SQL = `
select
    LTRIM(RTRIM(a.ndocu))                                  as documento,
    LTRIM(RTRIM(a.codcli))                                 as cliente,
    LTRIM(RTRIM(ISNULL(a.nomcli,'')))                      as cliente_nombre,
    a.TipEnt                                               as despacho_codigo,
    LTRIM(RTRIM(ISNULL(d.despacho,'')))                    as despacho_texto,
    CASE a.TipEnt when 3 then 'T0001' when 4 then LTRIM(RTRIM(a.codtra2)) END          as transportista_codigo,
    CASE a.TipEnt when 3 then (select LTRIM(RTRIM(nomtra)) from tbl01tra where codtra=a.codtra)
                  when 4 then (select LTRIM(RTRIM(nomtra)) from tbl01tra where codtra=a.codtra2) END as transportista_texto,
    LTRIM(RTRIM(ISNULL(a.Consig,'')))                      as atencion,
    LTRIM(RTRIM(ISNULL(a.dirent,'')))                      as direccion,
    LTRIM(RTRIM(ISNULL(a.codven_usu,'')))                  as vendedor_codigo,
    LTRIM(RTRIM(ISNULL(v.nomven,'')))                      as vendedor_texto,
    LTRIM(RTRIM(ISNULL(a.observ,'')))                      as observacion,
    LTRIM(RTRIM(ISNULL(a.orde,'')))                        as orden
from mst01fac a
left join tbl_tipo_despacho d on (d.IDdespacho=a.TipEnt)
left join tbl01ven v on (v.codven=a.codven_usu)
where a.cdocu in ('01','03') AND a.flag<>'*' AND a.ndge=''
  AND a.codven_usu=@codven AND a.ndocu=@doc`;

let factura_campos = (resolve,reject,conexion,galleta,cuerpo)=>{

    const codven = galleta ? galleta.codigo : null;
    const doc = String((cuerpo && (cuerpo.doc || cuerpo.ndocu)) || '').trim();

    if(!codven){ conexion.close(); return reject("falsa galleta"); }
    if(!doc){ conexion.close(); return reject("factura desconocida"); }

    let consulta = new Request(SQL,(err,rowCount,rows)=>{
        if(err){
            console.error("[factura_campos]",err);
            conexion.close();
            return reject("error query");
        }
        conexion.close();

        /////no existe, esta anulada, ya tiene guia, o es de otro vendedor: se responden
        /////igual a proposito, para no confirmar que un numero ajeno existe
        if(rows.length===0) return reject("factura desconocida");

        const f = {};
        rows[0].forEach(c=>{ f[c.metadata.colName] = typeof c.value==='string' ? c.value.trim() : c.value; });

        resolve({
            documento: f.documento,
            cliente:        f.cliente,
            clienteNombre:  f.cliente_nombre,
            despacho:      {codigo:f.despacho_codigo, texto:f.despacho_texto},
            transporte:    {codigo:f.transportista_codigo, texto:f.transportista_texto},
            atencion:      f.atencion,
            direccion:     f.direccion,
            vendedor:      {codigo:f.vendedor_codigo, texto:f.vendedor_texto},
            observacion:   f.observacion,
            orden:         f.orden
        });
    })
    consulta.addParameter('doc',TYPES.VarChar,doc);
    consulta.addParameter('codven',TYPES.VarChar,codven);
    conexion.execSql(consulta);
}

module.exports={factura_campos}
