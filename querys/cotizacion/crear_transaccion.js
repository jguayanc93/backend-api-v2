/////Envuelve en UNA transaccion los cuatro pasos que escriben al crear una cotizacion:
/////la cabecera, el detalle, el vendedor y el tipo de cambio.
/////
/////Antes cada uno abria su propia conexion. Si fallaba el tercero, la cotizacion quedaba
/////con cabecera y detalle grabados pero sin dueño: invisible para su vendedor y sin
/////forma de llegar a ella desde la intranet. Si fallaba el segundo, cabecera sin lineas.
/////
/////Los cuatro querys existentes se reutilizan tal cual, sin tocar sus bloques de
/////parametros -que en el del detalle son veintidos-. Se les presta la conexion con un
/////close() inocuo: ellos la "cierran" al terminar, que con el pool la devolveria y
/////abortaria la transaccion.

/////la misma conexion, pero que no se puede soltar desde dentro
function prestar(conexion){
    return {
        execSql: (p)=>conexion.execSql(p),
        callProcedure: (p)=>conexion.callProcedure(p),
        on: (e,cb)=>conexion.on(e,cb),
        close: ()=>{}
    };
}
function iniciar(conexion){
    return new Promise((res,rej)=>conexion.beginTransaction(e=>e?rej(e):res(),'crear_coti'));
}
function confirmar(conexion){
    return new Promise((res,rej)=>conexion.commitTransaction(e=>e?rej(e):res()));
}
function revertir(conexion){
    /////no se propaga el error del rollback: ya estamos en el camino de fallo
    return new Promise((res)=>conexion.rollbackTransaction(()=>res()));
}

/////pasos: lista de funciones que reciben la conexion prestada y devuelven una promesa.
/////Se ejecutan en orden; si una falla, se revierten todas.
let en_transaccion = async (resolve,reject,conexion,pasos)=>{
    const prestada = prestar(conexion);
    let abierta=false;

    try{
        await iniciar(conexion);
        abierta=true;

        const resultados = [];
        for(const paso of pasos){
            resultados.push(await paso(prestada));
        }

        await confirmar(conexion); abierta=false;
        conexion.close();
        resolve(resultados);
    }
    catch(err){
        console.error("[crear_cotizacion]",err);
        if(abierta) await revertir(conexion);
        conexion.close();
        /////se deja pasar el motivo si ya es uno del catalogo; si no, es un fallo de SQL
        reject(typeof err === 'string' ? err : "error query");
    }
}

module.exports={en_transaccion}
