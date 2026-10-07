/////Los constructores de lineas (descuento.js, bonificacion.js) emitian la respuesta HTTP
/////desde el fondo del calculo, asi que solo servian para /mostrar. Ahora entregan el
/////resultado a un "destino", que puede ser responder al cliente (vista previa) o
/////recolectar las lineas para insertarlas (/acoplar).

/////destino que responde por HTTP: el comportamiento de /mostrar
function haciaRespuesta(res, error_corrector){
    return {
        entregar(data){ res.status(200).json({"status":"ok","codigo":0,"data":data}); },
        fallar(mensaje){ error_corrector(res, mensaje); }
    };
}

/////destino que solo guarda lo construido, para que /acoplar lo inserte
function haciaMemoria(){
    const caja = {data:null, error:null, listo:false};
    caja.entregar = (data)=>{ caja.data=data; caja.listo=true; };
    caja.fallar = (mensaje)=>{ caja.error=mensaje; caja.listo=true; };
    /////espera a que el constructor termine: bonificacion resuelve de forma asincrona
    /////porque consulta los items de regalo contra la BD
    caja.esperar = (ms)=>new Promise((resolve,reject)=>{
        const limite = Date.now() + (ms||30000);
        (function revisar(){
            if(caja.listo) return caja.error ? reject(caja.error) : resolve(caja.data);
            if(Date.now() > limite) return reject("error query");
            setImmediate(revisar);
        })();
    });
    return caja;
}

/////envoltura cuyo close() no hace nada: se usa para prestarle la conexion de una
/////transaccion a bonificacion.js, que la cerraria al terminar su bucle
function sinCerrar(conexion){
    return {
        execSql: (p)=>conexion.execSql(p),
        callProcedure: (p)=>conexion.callProcedure(p),
        on: (e,cb)=>conexion.on(e,cb),
        close: ()=>{}
    };
}

module.exports={haciaRespuesta, haciaMemoria, sinCerrar};
