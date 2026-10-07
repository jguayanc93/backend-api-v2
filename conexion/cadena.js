require('dotenv').config();

const Connection=require('tedious').Connection;
const Request=require('tedious').Request;
const TYPES=require('tedious').TYPES;

/////La conexion se puede apuntar a otra base por variables de entorno (por ejemplo una
/////de pruebas) sin tocar codigo. Si no hay .env, se usan los valores de siempre, asi
/////que el comportamiento en produccion no cambia.
const config = {
    server: process.env.DB_SERVER || '192.168.1.101',
    authentication:{
        type:'default',
        options:{
            userName: process.env.DB_USER || 'sa',
            password: process.env.DB_PASSWORD || 'Nava2008'
        }
    },
    options:{
        encrypt: process.env.DB_ENCRYPT === 'true',
        database: process.env.DB_NAME || 'bdnava01',
        rowCollectionOnRequestCompletion:true,
        trustServerCertificate:true,
        requestTimeout: Number(process.env.DB_TIMEOUT || 60000)
    }
}

/////para saber contra que base se esta corriendo sin tener que adivinar
function descripcion(){ return config.options.database+' en '+config.server+' como '+config.authentication.options.userName; }

module.exports={config,Connection,Request,TYPES,descripcion}
