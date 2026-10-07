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

/////Pide el numero a la secuencia y, en el mismo viaje, comprueba si ya estaba usado.
/////La comprobacion es un seek por la PK (cdocu,ndocu), asi que no cuesta nada, y evita
/////que una secuencia mal arrancada tumbe todas las creaciones: si el START WITH quedo
/////por detras de lo que hay en mst01cot -por ejemplo al copiar el valor de otra base-,
/////cada INSERT chocaria con la clave primaria y el vendedor veria un 500.
const CON_SECUENCIA =
    "declare @n int = NEXT VALUE FOR dbo.seq_cotizacion_098;"+
    " declare @d char(12) = '"+SERIE+"' + RIGHT(REPLICATE('0',"+LARGO+")+CAST(@n as varchar("+LARGO+")),"+LARGO+");"+
    " select @n as numero,"+
    " case when exists(select 1 from mst01cot where cdocu='31' and ndocu=@d) then 1 else 0 end as tomado";
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
        const tomado = fila && fila.length > 1 ? fila[1].value : 0;
        alFallar(null, valor, tomado);
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

    pedir(conexion, CON_SECUENCIA, (err,valor,tomado)=>{
        if(err){
            /////no existe en esta base: se recuerda y se sigue con el calculo de antes
            haySecuencia = false;
            console.warn("[num_correlativo] sin secuencia, se usa el maximo de mst01cot");
            return usarRespaldo();
        }
        haySecuencia = true;

        /////la secuencia quedo por detras de mst01cot. Se sigue con el maximo para que el
        /////vendedor pueda trabajar, pero hay que reajustarla: mientras no se haga se
        /////vuelve a la carrera que la secuencia venia a evitar.
        if(tomado){
            console.warn("[num_correlativo] "+formatear(valor)+" ya existe: la secuencia va "+
                         "por detras de mst01cot. Reajustar con ALTER SEQUENCE "+
                         "dbo.seq_cotizacion_098 RESTART WITH <ultimo 098- + 1>");
            return usarRespaldo();
        }

        conexion.close();
        if(valor == null) return reject("correlativo inexistente");
        resolve(formatear(valor));
    });
}

module.exports={num_correlativo}
