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
/////
/////POR QUE HAY REINTENTOS
/////---------------------
/////Agrupar los cuatro pasos alarga el tiempo que la transaccion retiene bloqueos sobre
/////mst01cot, y los triggers del ERP suman el detalle entero en cada UPDATE. Con dos
/////cotizaciones creandose a la vez, SQL Server detecta un bloqueo mutuo y elige una como
/////victima: error 1205, "Rerun the transaction". Reproducido con tres creaciones en
/////paralelo -dos de las tres caian con 500-.
/////
/////El propio motor dice que la solucion es reintentar, y aqui es seguro: la victima se
/////revierte entera, asi que al repetir no queda nada a medias. El numero de cotizacion
/////ya esta reservado y la fila que lo usaba desaparecio con el rollback.
/////
/////Los querys internos solo devuelven el texto "error query", asi que el numero real del
/////error se captura escuchando errorMessage en la conexion.

const REINTENTOS = 3;
const ESPERA_BASE = 120;          ////ms; se suma algo de azar para no chocar otra vez

const BLOQUEO_MUTUO = 1205;
const CLAVE_DUPLICADA = [2627,2601];

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
    /////si SQL Server ya la revirtio -lo hace al elegir victima de un bloqueo mutuo-,
    /////pedirla otra vez solo produce el error 3903
    if(conexion.inTransaction === false) return Promise.resolve();
    /////no se propaga el error del rollback: ya estamos en el camino de fallo
    return new Promise((res)=>conexion.rollbackTransaction(()=>res()));
}

function dormir(ms){ return new Promise(res=>setTimeout(res,ms)); }

/////un intento completo. Devuelve los resultados o lanza.
async function intentar(conexion, pasos){
    const prestada = prestar(conexion);
    let abierta = false;
    try{
        await iniciar(conexion);
        abierta = true;

        const resultados = [];
        for(const paso of pasos){
            resultados.push(await paso(prestada));
        }

        await confirmar(conexion);
        return resultados;
    }
    catch(err){
        if(abierta) await revertir(conexion);
        throw err;
    }
}

/////pasos: lista de funciones que reciben la conexion prestada y devuelven una promesa.
/////Se ejecutan en orden; si una falla, se revierten todas.
let en_transaccion = async (resolve,reject,conexion,pasos)=>{

    /////el numero del ultimo error que mando el servidor, que los querys no propagan
    let ultimo = null;
    const anotar = (e)=>{ ultimo = e; };
    conexion.on('errorMessage', anotar);

    try{
        for(let intento=1; intento<=REINTENTOS; intento++){
            ultimo = null;
            try{
                const resultados = await intentar(conexion, pasos);
                resolve(resultados);
                return;
            }
            catch(err){
                const numero = ultimo && ultimo.number;

                if(numero === BLOQUEO_MUTUO && intento < REINTENTOS){
                    const espera = ESPERA_BASE * intento + Math.floor(Math.random()*100);
                    console.warn("[crear_cotizacion] bloqueo mutuo, reintento "+
                                 (intento+1)+" de "+REINTENTOS+" en "+espera+" ms");
                    await dormir(espera);
                    continue;
                }

                /////El numero de cotizacion ya existe. Pasa cuando la secuencia
                /////seq_cotizacion_098 arranco por detras de lo que ya hay en mst01cot
                /////-por ejemplo si se creo con el START WITH de otra base-. Se dice con
                /////claridad en vez de dejarlo en "fallo una consulta sql", porque la
                /////solucion es una sola linea:
                /////    ALTER SEQUENCE dbo.seq_cotizacion_098 RESTART WITH <ultimo+1>;
                if(CLAVE_DUPLICADA.includes(numero)){
                    console.error("[crear_cotizacion] numero repetido: la secuencia va por "+
                                  "detras de mst01cot. Corregir con ALTER SEQUENCE "+
                                  "dbo.seq_cotizacion_098 RESTART WITH <ultimo+1>");
                    reject("correlativo duplicado");
                    return;
                }

                console.error("[crear_cotizacion]", (ultimo && ultimo.message) || err);
                /////se deja pasar el motivo si ya es uno del catalogo; si no, es un fallo de SQL
                reject(typeof err === 'string' ? err : "error query");
                return;
            }
        }
    }
    finally{
        conexion.removeListener('errorMessage', anotar);
        conexion.close();
    }
}

module.exports={en_transaccion}
