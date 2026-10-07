/////pool de conexiones para tedious.
/////antes cada consulta abria un Connection nuevo (handshake TCP + login SQL completo),
/////asi que una sola peticion a /mostrar gastaba 5 logins. aca se reutilizan.
const {config, Connection} = require('./cadena');

const MAXIMO = Number(process.env.DB_POOL_MAX || 10);
const ESPERA_MAXIMA = Number(process.env.DB_POOL_ESPERA || 20000);

let libres = [];      ////conexiones listas para prestar
let enCola = [];      ////quienes esperan turno porque el pool esta lleno
let vivas = 0;        ////cuantas conexiones existen (prestadas + libres)

function crear(){
    return new Promise((resolve, reject) => {
        const conexion = new Connection(config);
        let resuelto = false;

        conexion.on('connect', (err) => {
            if(resuelto) return;
            resuelto = true;
            if(err){ vivas--; reject(err); }
            else { resolve(conexion); }
        });

        /////si el socket se cae, la conexion queda inservible: se marca para no devolverla al pool
        conexion.on('error', (err) => {
            conexion.__rota = true;
            console.error('[pool] conexion con error', err && err.message);
        });

        conexion.on('end', () => {
            conexion.__rota = true;
            libres = libres.filter(c => c !== conexion);
            vivas--;
            atenderCola();
        });

        vivas++;
        conexion.connect();
    });
}

/////entrega una conexion al primero que este esperando
function atenderCola(){
    if(enCola.length === 0) return;
    if(libres.length === 0 && vivas >= MAXIMO) return;

    const turno = enCola.shift();
    clearTimeout(turno.reloj);

    const reutilizable = libres.pop();
    if(reutilizable){ turno.resolve(envolver(reutilizable)); return; }

    crear().then(c => turno.resolve(envolver(c))).catch(err => turno.reject(err));
}

/////devuelve la conexion al pool limpiando el estado de sesion (transacciones abiertas, temp tables)
function soltar(conexion){
    if(conexion.__rota){
        vivas--;
        try{ conexion.close(); }catch(e){}
        atenderCola();
        return;
    }

    conexion.reset((err) => {
        if(err){
            vivas--;
            try{ conexion.close(); }catch(e){}
        }
        else{ libres.push(conexion); }
        atenderCola();
    });
}

/////envoltura que conserva la interfaz que ya usan las ~94 consultas:
/////execSql / callProcedure siguen igual, y close() ahora libera en vez de cerrar el socket
function envolver(conexion){
    let entregada = false;

    return {
        __real: conexion,
        execSql: (peticion) => conexion.execSql(peticion),
        callProcedure: (peticion) => conexion.callProcedure(peticion),
        beginTransaction: (cb, nombre, aislamiento) => conexion.beginTransaction(cb, nombre, aislamiento),
        commitTransaction: (cb) => conexion.commitTransaction(cb),
        rollbackTransaction: (cb) => conexion.rollbackTransaction(cb),
        on: (evento, cb) => conexion.on(evento, cb),
        /////hace falta para no dejar escuchadores pegados a una conexion que se reutiliza
        removeListener: (evento, cb) => conexion.removeListener(evento, cb),
        /////¿hay transaccion abierta de verdad? SQL Server ya revierte sola cuando elige
        /////a esta sesion como victima de un bloqueo mutuo, y pedir el rollback despues
        /////da el error 3903
        get inTransaction(){ return conexion.inTransaction; },
        /////idempotente: si un handler la libera dos veces, la segunda no hace nada
        close: () => {
            if(entregada) return;
            entregada = true;
            soltar(conexion);
        }
    };
}

function adquirir(){
    const reutilizable = libres.pop();
    if(reutilizable) return Promise.resolve(envolver(reutilizable));

    if(vivas < MAXIMO) return crear().then(envolver);

    /////pool lleno: esperar turno en vez de abrir una conexion mas
    return new Promise((resolve, reject) => {
        const turno = {resolve, reject};
        turno.reloj = setTimeout(() => {
            enCola = enCola.filter(t => t !== turno);
            reject('error query');
        }, ESPERA_MAXIMA);
        enCola.push(turno);
    });
}

function estado(){ return {vivas, libres: libres.length, enCola: enCola.length, maximo: MAXIMO}; }

module.exports = {adquirir, estado};
