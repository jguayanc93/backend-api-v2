const {listar, texto, TYPES} = require('./opciones');

/////Los tipos de despacho: son tres y fijas, asi que la pantalla las pinta enteras.
/////Devuelve {total, data} como las otras cuatro listas.
let factura_sugerencia_despacho = (resolve,reject,conexion,body)=>{
    listar(conexion,
        "select IDdespacho,despacho,COUNT(*) OVER () as total from tbl_tipo_despacho"+
        " where estado=1 AND IDdespacho in (1,3,4) and despacho LIKE @pista",
        [{nombre:'pista',tipo:TYPES.VarChar,valor:texto(body && body.sugerencia)}]
    ).then(resolve).catch(reject);
}

module.exports={factura_sugerencia_despacho}
