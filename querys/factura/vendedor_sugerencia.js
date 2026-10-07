const {listar, texto, TYPES} = require('./opciones');

/////Los vendedores activos, para reasignar la factura.
/////
/////La consulta anterior era copia de la de despacho: devolvia el tipo de despacho de la
/////factura en vez de la lista, y usaba @codven sin declararlo, asi que respondia 500.
let factura_sugerencia_vendedor = (resolve,reject,conexion,body)=>{
    listar(conexion,
        "select top 5 codven,nomven,COUNT(*) OVER () as total from tbl01ven"+
        " where estado=1 and nomven like @pista",
        [{nombre:'pista',tipo:TYPES.VarChar,valor:texto(body && body.sugerencia)}]
    ).then(resolve).catch(reject);
}

module.exports={factura_sugerencia_vendedor}
