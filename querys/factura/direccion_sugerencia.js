const {listar, ES_SU_CLIENTE, TYPES} = require('./opciones');

/////Las direcciones de entrega de un cliente. Sin tope y sin filtro: una direccion no se
/////adivina, se reconoce, asi que la pantalla las enseña todas y filtra en local. El
/////cliente con 195 es raro y no deberia empeorar los miles normales.
/////
/////Misma comprobacion que atencion: solo si el vendedor tiene facturas con ese cliente.
let factura_sugerencia_direccion = (resolve,reject,conexion,galleta,body)=>{
    const codven = galleta ? galleta.codigo : null;
    const cli = String((body && body.cli) || '').trim();

    if(!codven){ conexion.close(); return reject("falsa galleta"); }
    if(!cli){ conexion.close(); return reject("cliente ajeno"); }

    listar(conexion,
        "select dirent,COUNT(*) OVER () as total from ("+
        "   select dirent from mst01cli where codcli=@cliente and LTRIM(RTRIM(ISNULL(dirent,'')))<>''"+
        "   union"+
        "   select dirent from Dtl_Cliente_Alias where codcli=@cliente and LTRIM(RTRIM(ISNULL(dirent,'')))<>''"+
        ") d where exists(select 1 from mst01fac f where f.codcli=@cliente and f.codven_usu=@codven"+
        "                 and f.cdocu in ('01','03') and f.flag<>'*')",
        [{nombre:'cliente',tipo:TYPES.VarChar,valor:cli},
         {nombre:'codven',tipo:TYPES.VarChar,valor:codven}]
    ).then(resolve).catch(reject);
}

module.exports={factura_sugerencia_direccion}
