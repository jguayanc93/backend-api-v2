const {adquirir} = require('./pool');

/////se conserva la firma conn(resolve,reject) para no tocar los 76 archivos que la usan.
/////lo unico que cambia es que ahora la conexion sale del pool, y el .close() que ya
/////hacen las consultas la devuelve al pool en vez de cerrar el socket.
function conn(resolve, reject){
    adquirir().then(resolve).catch((err) => {
        console.error('[conexion] no se pudo obtener conexion del pool', err && err.message ? err.message : err);
        reject('error query');
    });
}

module.exports = {conn};
