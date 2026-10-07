require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')

/////El numero de la siguiente cotizacion de la serie 098-, que es la que crea /pegar.
/////
/////Sale de una SEQUENCE, que lo entrega de forma atomica: dos peticiones a la vez
/////reciben numeros distintos. Antes se leia el maximo de mst01cot y se sumaba 1 en
/////JavaScript, asi que dos creaciones simultaneas calculaban el mismo numero; no
/////corrompia datos -la PK (cdocu,ndocu) lo impide- pero la segunda INSERT fallaba con
/////violacion de clave y el vendedor perdia la cotizacion con un 500.
/////
/////De paso deja de costar un recorrido de mst01cot entera: RIGHT() y LEFT() sobre la
/////columna impedian usar indice. Medido: 132 ms antes, 7 ms ahora.
/////
/////Si la secuencia no existe se vuelve al calculo anterior, para que el backend arranque
/////igual en una base donde todavia no se haya creado. El script esta en
/////querys/sp/seq_cotizacion_098.sql.

const SERIE = "098-";
const LARGO = 8;

const CON_SECUENCIA = "select NEXT VALUE FOR dbo.seq_cotizacion_098 as numero";
const SIN_SECUENCIA =
    "select ISNULL(MAX(CAST(RIGHT(ndocu,"+LARGO+") AS int)),0)+1 as numero"+
    " from mst01cot where LEFT(ndocu,3)='098'";

/////¿existe la secuencia? Se pregunta una vez por arranque y se recuerda.
let haySecuencia = null;

function formatear(numero){
    const n = String(numero);
    return SERIE + (n.length < LARGO ? "0".repeat(LARGO - n.length) + n : n);
}

function pedir(conexion, sql, alFallar){
    const consulta = new Request(sql,(err,rowCount,rows)=>{
        if(err) return alFallar(err);
        const fila = rows && rows.length ? rows[0] : null;
        const valor = fila ? fila[0].value : null;
        alFallar(null, valor);
    });
    conexion.execSql(consulta);
}

let num_correlativo = (resolve,reject,conexion)=>{

    const usarRespaldo = ()=>{
        pedir(conexion, SIN_SECUENCIA, (err,valor)=>{
            conexion.close();
            if(err){
                console.error("[num_correlativo]",err);
                return reject("error query");
            }
            if(valor == null) return reject("correlativo inexistente");
            resolve(formatear(valor));
        });
    };

    if(haySecuencia === false) return usarRespaldo();

    pedir(conexion, CON_SECUENCIA, (err,valor)=>{
        if(err){
            /////no existe en esta base: se recuerda y se sigue con el calculo de antes
            haySecuencia = false;
            console.warn("[num_correlativo] sin secuencia, se usa el maximo de mst01cot");
            return usarRespaldo();
        }
        haySecuencia = true;
        conexion.close();
        if(valor == null) return reject("correlativo inexistente");
        resolve(formatear(valor));
    });
}

module.exports={num_correlativo}
