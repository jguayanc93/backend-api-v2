const {listar, texto, ES_SU_CLIENTE, TYPES} = require('./opciones');

/////Los contactos de un cliente. Lo que devuelve no es una referencia interna: es nombre
/////y documento de una persona, asi que la lista solo se entrega si el vendedor tiene
/////alguna factura con ese cliente.
let factura_sugerencia_atencion = (resolve,reject,conexion,galleta,body)=>{
    const codven = galleta ? galleta.codigo : null;
    const cli = String((body && body.cli) || '').trim();

    if(!codven){ conexion.close(); return reject("falsa galleta"); }
    if(!cli){ conexion.close(); return reject("cliente ajeno"); }

    listar(conexion,
        "select top 5 Nomcon,COUNT(*) OVER () as total from Dtl01Con"+
        " where Codn=@cliente and Nomcon like @pista"+ES_SU_CLIENTE,
        [{nombre:'cliente',tipo:TYPES.VarChar,valor:cli},
         {nombre:'codven',tipo:TYPES.VarChar,valor:codven},
         {nombre:'pista',tipo:TYPES.VarChar,valor:texto(body && body.sugerencia)}]
    ).then(resolve).catch(reject);
}

module.exports={factura_sugerencia_atencion}
