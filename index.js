require('dotenv').config();

const express = require('express')
const cors = require('cors')
const jwt = require('jws')
const cookieParser = require('cookie-parser')

const corhabilitaciones = require('./cors/conf')

const app = express();
const port = process.env.PORT || 3000;

// app.set('trust proxy','127.0.0.1');

app.use(cors(corhabilitaciones))

app.use([express.json(),cookieParser('CDK')])////este siempre data error en produccion

const ruta = require('./rutas/rutas')

app.use('/v1',express.static('public'))

app.use('/v1/login',ruta.login);

app.use('/v1/logout',ruta.logout);

app.use('/v1/vendedor',ruta.vendedor);

app.use('/v1/cotizacion',ruta.coti)

app.use('/v1/pedido',ruta.pedido);

app.use('/v1/cliente',ruta.cliente);

app.use('/v1/producto',ruta.producto);

app.use('/v1/promocion',ruta.promocion);

app.use('/v1/cuota',ruta.cuotas);

app.use('/v1/lista',ruta.lista);

app.use('/v1/programador',ruta.programador);

app.use('/v1/factura',ruta.factura);

app.use('/v1/reporte',ruta.reporte);

/////manejador 404: cae aqui cualquier ruta no montada arriba
app.use((req,res)=>{
    res.status(404).json({"status":"no encontrado","codigo":4,"msg":"la ruta solicitada no existe"});
})

/////manejador global de errores: atrapa lo que se escape de los try/catch de cada handler
/////sin esto, express responde un html con stack trace
app.use((err,req,res,next)=>{
    console.error("[error no capturado]",req.method,req.originalUrl,err);
    if(res.headersSent){ return next(err); }
    res.status(500).json({"status":"ERROR","codigo":1,"msg":"error interno del servidor"});
})

/////en node 20+ una promesa rechazada sin capturar mata el proceso.
/////como el servicio se levanta a mano, eso significa caida hasta que alguien entre al servidor.
process.on("unhandledRejection",(motivo)=>{
    console.error("[promesa rechazada sin capturar]",motivo);
})

process.on("uncaughtException",(err)=>{
    console.error("[excepcion no capturada]",err);
})

const {descripcion} = require('./conexion/cadena');
app.listen(port,()=>{console.log("servicio levantado en el puerto "+port+" | base: "+descripcion())})