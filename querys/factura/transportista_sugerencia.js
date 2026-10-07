const {listar, texto, TYPES} = require('./opciones');

/////Los transportistas activos. Son 358, asi que viajan de cinco en cinco y el total
/////dice cuantos hay detras del filtro.
let factura_sugerencia_transportista = (resolve,reject,conexion,body)=>{
    listar(conexion,
        "select top 5 codtra,nomtra,COUNT(*) OVER () as total from tbl01tra"+
        " where estado=1 and nomtra like @pista",
        [{nombre:'pista',tipo:TYPES.VarChar,valor:texto(body && body.sugerencia)}]
    ).then(resolve).catch(reject);
}

module.exports={factura_sugerencia_transportista}
