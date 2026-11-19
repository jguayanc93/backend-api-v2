const {Request,TYPES} = require('../../conexion/cadena')

/////Los datos del cliente que van en la cabecera de una cotizacion nueva.
/////
/////Hasta el 18/11/2026 /pegar grababa nombre, RUC, vendedor y condicion de venta tal como
/////venian en el cuerpo ("cliente":[codcli,nomcli,ruccli,codven,codcdv]), sin mirar la
/////base: un cuerpo armado a mano podia dejar una cotizacion con el RUC o el vendedor de
/////otro. Ahora del cuerpo solo se usa el codigo y lo demas sale de mst01cli, la misma
/////fila que la pantalla ya leia con /cliente/id.
/////
/////Devuelve el arreglo en las posiciones de siempre para no tocar crear_cabecera:
/////0 codcli, 1 nomcli, 2 ruccli, 3 codven, 4 codcdv.
let cliente_cotizacion = (resolve,reject,conexion,codcli)=>{
    const codigo = String(codcli == null ? '' : codcli).trim();
    if(!codigo){ conexion.close(); return reject("cliente no registrado"); }

    const consulta = new Request(
        "select codcli,nomcli,ruccli,codven,codcdv from mst01cli where estado=1 and codcli=@codcli",
        (err,rowCount,rows)=>{
            conexion.close();
            if(err){ console.error("[cliente_cotizacion]",err); return reject("error query"); }
            if(!rows || rows.length===0) return reject("cliente no registrado");
            resolve(rows[0].map(c => typeof c.value === 'string' ? c.value.trim() : c.value));
        });
    consulta.addParameter('codcli',TYPES.VarChar,codigo);
    conexion.execSql(consulta);
}

module.exports={cliente_cotizacion}
