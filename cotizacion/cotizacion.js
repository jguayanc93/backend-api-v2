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
const {coti_permisos} = require('../funciones/cotizacion/permisos')
const {modificacion} = require('../funciones/cotizacion/modificar')
const {revisar} = require('../funciones/cotizacion/mostrar')
const {ver_all} = require('../funciones/cotizacion/mostrar_todo')
const {almacen_cambio} = require('../funciones/cotizacion/almacen')
///////cambio de perspectiva para la creacion de cotizacion en nueva ruta
const {new_creacion} = require('../funciones/cotizacion/new_crear')
const {eliminacion} = require('../funciones/cotizacion/eliminar')
const {exigirPermiso} = require('../funciones/comunes/auth')

router.use(express.json());

//////TENDRAS QUE LANSAR RUTAS ALTERNAS PARA CADA TIPO DE VENDEDOR
router.get('/',objevacio,coti_permisos)
// router.get('/',(req,res)=>{res.status(200).send("deberia enviarte al login de nuevo por no tener galletas")})

/////estas rutas son para sus respectivos accesos segun pueda o no
router.post('/pegar',auditar('cotizacion','crear'),new_creacion)
router.post('/read',revisar)
router.post('/readprom',ver_all)
router.post('/update',auditar('cotizacion','modificar'),modificacion)
router.post('/almacen',auditar('cotizacion','almacen'),almacen_cambio)
router.post('/eliminar',auditar('cotizacion','dar de baja'),exigirPermiso('cotizacion','delete'),eliminacion)

module.exports=router