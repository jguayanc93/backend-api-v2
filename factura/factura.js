require('dotenv').config();
const {auditar} = require('../funciones/comunes/auditoria')

const express = require('express');
// const multer= require('multer')
const router = express.Router();
// const upload = multer();
///////ESPACIO PARA FUNCIONES GENERALES SI TUVIERA 0 REQUIERA
const {objevacio} = require('../funciones/objvacio')
//////ESPACIO PARA FUNCIONES DE COMPROBACION PARA LOS QUERYS
const {vendedor_permisos} = require('../funciones/vendedor/redirigir_tipo')
// const {grupos_modulos} = require('../funciones/vendedor/cobertura_modulos')
const {factura_permisos} = require('../funciones/factura/permisos')
const {facturaxcampos} = require('../funciones/factura/campos')
const {exigirPermiso} = require('../funciones/comunes/auth')

const {facturaxdespachoxsugerencia} = require('../funciones/factura/cambio_despacho')
const {facturaxtransportistaxsugerencia} = require('../funciones/factura/cambio_transportista')
const {facturaxatencionxsugerencia} = require('../funciones/factura/cambio_atencion')
const {facturaxdireccionxsugerencia} = require('../funciones/factura/cambio_direccion')
const {facturaxvendedorxsugerencia} = require('../funciones/factura/cambio_vendedor')
const {facturaxcampoxcambiado} = require('../funciones/factura/campo_cambiado')

router.use(express.json());

//////TENDRAS QUE LANSAR RUTAS ALTERNAS PARA CADA TIPO DE VENDEDOR
router.get('/',objevacio,factura_permisos)
// router.get('/',(req,res)=>{res.status(200).send("deberia enviarte al login de nuevo por no tener galletas")})

/////estas rutas son para sus respectivos accesos segun pueda o no
router.post('/campos',facturaxcampos)
router.post('/despacho/cambio',exigirPermiso('factura','despacho'),facturaxdespachoxsugerencia)
router.post('/transporte/cambio',exigirPermiso('factura','transporte'),facturaxtransportistaxsugerencia)
router.post('/atencion/cambio',exigirPermiso('factura','atencion'),facturaxatencionxsugerencia)
router.post('/direccion/cambio',exigirPermiso('factura','direccion'),facturaxdireccionxsugerencia)
router.post('/vendedor/cambio',exigirPermiso('factura','vendedor'),facturaxvendedorxsugerencia)

router.post('/cambiado',auditar('factura','cambiar campo'),facturaxcampoxcambiado)


module.exports=router