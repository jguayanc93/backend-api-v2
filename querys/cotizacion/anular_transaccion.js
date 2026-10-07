const {Request,TYPES} = require('../../conexion/cadena');
const {normalizarNdocu} = require('../../funciones/comunes/constantes');

/////Da de baja una cotizacion llamando al procedimiento del ERP, AnulaCotFac, dentro de
/////una transaccion y con todas las comprobaciones hechas antes.
/////
/////AnulaCotFac no valida nada: anula lo que se le pase. Por dentro son dos UPDATE
/////sueltos (cabecera y detalle), asi que si el segundo falla la cotizacion queda con la
/////cabecera anulada y el detalle vivo. De ahi la transaccion.
/////
/////El procedimiento recibe cdocu y ndocu juntos en un solo char(14), no el ndocu solo.

const MOTIVO_POR_DEFECTO = 'ANULADA DESDE INTRANET(01)';   ////01 = "Error (otros)" en Tbl_motivo_anucot
const LARGO_MOTIVO = 100;                                  ////mst01cot.motanu es char(100)

function ejecutar(conexion, sql, parametros){
    return new Promise((resolve,reject)=>{
        const consulta = new Request(sql,(err,rowCount,rows)=>{
            if(err) return reject(err);
            resolve({rowCount:rowCount, rows:rows||[]});
        });
        (parametros||[]).forEach(p=>consulta.addParameter(p.nombre,p.tipo,p.valor));
        conexion.execSql(consulta);
    });
}
function iniciar(conexion){
    return new Promise((res,rej)=>conexion.beginTransaction(e=>e?rej(e):res(),'anular_coti'));
}
function confirmar(conexion){
    return new Promise((res,rej)=>conexion.commitTransaction(e=>e?rej(e):res()));
}
function revertir(conexion){
    /////no se propaga el error del rollback: ya estamos en el camino de fallo
    return new Promise((res)=>conexion.rollbackTransaction(()=>res()));
}

let anular_cotizacion = async (resolve,reject,conexion,galleta,cuerpo)=>{
    const codven = galleta ? galleta.codigo : null;
    const documento = normalizarNdocu(cuerpo ? cuerpo.ndocu : null);

    if(!codven){ conexion.close(); return reject("falsa galleta"); }
    if(!documento){ conexion.close(); return reject("documento ambiguo"); }

    const motivo = recortar(cuerpo ? cuerpo.motivo : null);

    let abierta=false;
    try{
        await iniciar(conexion);
        abierta=true;

        /////1) existir, ser de este vendedor, y en que estado esta.
        /////   flag y estado se comparan como texto: las anuladas tienen flag='*' y
        /////   convertirlo a numero revienta la consulta.
        const cabecera = await ejecutar(conexion,
            "select cdocu, flag, estado from mst01cot with (updlock) where ndocu=@coti and codven_usu=@codven",
            [{nombre:'coti',tipo:TYPES.VarChar,valor:documento},
             {nombre:'codven',tipo:TYPES.VarChar,valor:codven}]);

        /////no existe, o es de otro vendedor: se responden igual, para no confirmar que
        /////un numero ajeno existe
        if(cabecera.rows.length===0){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("coti desconocida");
        }

        const fila   = cabecera.rows[0];
        const cdocu  = String(fila[0].value||'').trim();
        const flag   = String(fila[1].value||'').trim();
        const estado = String(fila[2].value||'').trim();

        /////2) cada negativa con su propio motivo, para que la pantalla diga que hacer
        const negativa = porQueNoSePuede(flag,estado);
        if(negativa){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject(negativa);
        }

        /////3) el ERP arma el documento como cdocu + ndocu en un char(14).
        /////   cdocu se lee de la fila en vez de darlo por hecho.
        await ejecutar(conexion,
            "exec AnulaCotFac @cDocumento=@doc14, @motanu=@mot",
            [{nombre:'doc14',tipo:TYPES.Char,valor:cdocu+documento},
             {nombre:'mot',tipo:TYPES.Char,valor:motivo}]);

        /////4) confirmar que quedo anulada de verdad antes de dar por buena la operacion
        const comprobacion = await ejecutar(conexion,
            "select flag from mst01cot where ndocu=@coti and cdocu=@cdocu",
            [{nombre:'coti',tipo:TYPES.VarChar,valor:documento},
             {nombre:'cdocu',tipo:TYPES.VarChar,valor:cdocu}]);

        const quedo = comprobacion.rows.length ? String(comprobacion.rows[0][0].value||'').trim() : '';
        if(quedo !== '*'){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("baja no aplicada");
        }

        await confirmar(conexion); abierta=false;
        conexion.close();
        resolve({documento:documento, motivo:motivo});
    }
    catch(err){
        console.error("[anular_cotizacion]",err);
        if(abierta) await revertir(conexion);
        conexion.close();
        reject("error query");
    }
}

/////Devuelve el mensaje de rechazo, o null si se puede dar de baja.
/////
/////flag:   '0' abierta · '1' ya facturada, pedido o boleta · '*' ya anulada
/////estado: '0' sin aprobar · '3' aprobada · '4' otro estado posterior
function porQueNoSePuede(flag,estado){
    if(flag === '*')  return "coti ya anulada";
    if(flag !== '0')  return "coti no anulable";
    if(estado !== '0') return "coti aprobada";
    return null;
}

function recortar(valor){
    const v = String(valor == null ? "" : valor).trim();
    if(v === "") return MOTIVO_POR_DEFECTO;
    return v.slice(0,LARGO_MOTIVO);
}

module.exports={anular_cotizacion}
