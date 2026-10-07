const {Request,TYPES} = require('../../conexion/cadena');
const {SKU_DESCUENTO, MARCA_FLETE} = require('../../funciones/comunes/constantes');

/////Aplica el flete de provincia a un pedido, llamando al procedimiento del ERP.
/////
/////Quien decide el flete es el trigger PromoFletePed sobre mst01ped, y ahi se queda: el
/////procedimiento solo lo habilita, pone apro=1 para dispararlo, y lo vuelve a deshabilitar.
/////El trigger comprueba por su cuenta el departamento del cliente, el monto minimo y si
/////la linea ya existe, asi que no se replica ninguna de esas reglas aqui: duplicarlas
/////seria garantizar que un dia digan cosas distintas.
/////
/////Lo que si hace falta alrededor:
/////
/////  - el procedimiento recibe @doc. El codigo mandaba @numero, asi que SQL Server
/////    rechazaba cada llamada con "expects parameter '@doc'". La ruta respondia 500
/////    siempre: nunca llego a aplicar un flete.
/////
/////  - no comprueba de quien es el pedido ni en que estado esta. Eso se hace aqui.
/////
/////  - el trigger puede no hacer nada en silencio -cliente de Lima, pedido por debajo
/////    del minimo, flete ya aplicado- y antes se respondia "flete aplicado correctamente"
/////    igual. Se cuenta la linea de flete antes y despues para decir lo que de verdad paso.

function ejecutar(conexion, sql, parametros){
    return new Promise((resolve,reject)=>{
        const consulta = new Request(sql,(err,rowCount,rows)=>{
            if(err) return reject(err);
            resolve(rows||[]);
        });
        (parametros||[]).forEach(p=>consulta.addParameter(p.nombre,p.tipo,p.valor));
        conexion.execSql(consulta);
    });
}
function llamarProcedimiento(conexion, nombre, parametros){
    return new Promise((resolve,reject)=>{
        const consulta = new Request(nombre,(err)=>err?reject(err):resolve());
        (parametros||[]).forEach(p=>consulta.addParameter(p.nombre,p.tipo,p.valor));
        conexion.callProcedure(consulta);
    });
}

/////la linea que deja el trigger: mismo SKU de descuento que usan las promociones
const CONTAR_FLETE =
    "select COUNT(*) from dtl01ped where ndocu=@doc and codi=@sku and LEFT(descr,27)=@marca";
const TOTALES =
    "select tota, toti, totn from mst01ped where ndocu=@doc";
/////el total SIN IGV del pedido, que es contra lo que el trigger mide el minimo
const CABECERA =
    "select LTRIM(RTRIM(ISNULL(m.mone,''))) mone, ISNULL(m.tcam,0) tcam, "+
    "ISNULL((select SUM(tota) from dtl01ped where ndocu=m.ndocu),0) tota "+
    "from mst01ped m where m.ndocu=@doc";

/////En dolares el minimo son 400; en soles, 400 por el tipo de cambio del pedido. Es la
/////misma cuenta que hace el trigger, reproducida al pie de la letra: si aqui fuera mas
/////estricta, estariamos negando un flete que el ERP si daria.
const MINIMO_FLETE = 400;
function minimoDe(mone, tcam){
    if(mone === 'D') return MINIMO_FLETE;
    if(mone === 'S') return MINIMO_FLETE * Number(tcam);
    return null;   ////cualquier otra moneda: el trigger no da flete
}

let activar_flete = async (resolve,reject,conexion,galleta,cuerpo)=>{
    const codven = galleta ? galleta.codigo : null;
    const npedi  = String((cuerpo && cuerpo.npedi) || '').trim();

    if(!codven){ conexion.close(); return reject("falsa galleta"); }
    if(!npedi){  conexion.close(); return reject("pedido desconocido"); }

    const delPedido = ()=>[
        {nombre:'doc',tipo:TYPES.VarChar,valor:npedi},
        {nombre:'sku',tipo:TYPES.VarChar,valor:SKU_DESCUENTO},
        {nombre:'marca',tipo:TYPES.VarChar,valor:MARCA_FLETE}
    ];

    try{
        /////1) tiene que ser suyo y no estar atendido ni anulado
        const duenio = await ejecutar(conexion,
            "select ndocu from mst01ped where ndocu=@doc and codven_usu=@codven and flag='0'",
            [{nombre:'doc',tipo:TYPES.VarChar,valor:npedi},
             {nombre:'codven',tipo:TYPES.VarChar,valor:codven}]);

        if(duenio.length===0){
            conexion.close();
            return reject("pedido no modificable");
        }

        /////2) si ya lo tiene, no se llama al procedimiento: el trigger tampoco haria nada,
        /////   pero asi se evita habilitarlo sin motivo
        const antes = Number((await ejecutar(conexion, CONTAR_FLETE, delPedido()))[0][0].value);
        if(antes > 0){
            conexion.close();
            return reject("flete ya aplicado");
        }

        /////3) el monto minimo, comprobado ANTES de llamar al procedimiento.
        /////   El trigger lo compara igual, pero para entonces el pedido ya quedo con
        /////   apro=1; y ademas asi se puede decir cuanto falta, no solo que no llega.
        const cab = (await ejecutar(conexion, CABECERA,
            [{nombre:'doc',tipo:TYPES.VarChar,valor:npedi}]))[0];

        const mone  = String(cab[0].value||'').trim();
        const tcam  = Number(cab[1].value||0);
        const total = Number(cab[2].value||0);
        const minimo = minimoDe(mone, tcam);

        if(minimo === null){
            conexion.close();
            return reject("flete no corresponde");
        }
        if(total < minimo){
            conexion.close();
            return reject({
                clave:  "flete monto insuficiente",
                moneda: mone,
                total:  Number(total.toFixed(2)),
                minimo: Number(minimo.toFixed(2)),
                falta:  Number((minimo - total).toFixed(2))
            });
        }

        /////4) el procedimiento del ERP. El parametro se llama @doc.
        await llamarProcedimiento(conexion,'jc_activar_flete_externo',
            [{nombre:'doc',tipo:TYPES.VarChar,valor:npedi}]);

        /////5) que paso de verdad
        const despues = Number((await ejecutar(conexion, CONTAR_FLETE, delPedido()))[0][0].value);
        if(despues === 0){
            conexion.close();
            return reject("flete no corresponde");
        }

        const t = (await ejecutar(conexion, TOTALES, [{nombre:'doc',tipo:TYPES.VarChar,valor:npedi}]))[0];
        conexion.close();
        resolve({
            documento: npedi,
            totales: { tota:Number(t[0].value), toti:Number(t[1].value), totn:Number(t[2].value) }
        });
    }
    catch(err){
        /////los rechazos propios ya vienen con su clave: no son fallos de SQL
        if(err && err.clave){ conexion.close(); return reject(err); }
        console.error("[activar_flete]",err);
        conexion.close();
        reject("error query");
    }
}

module.exports={activar_flete}
