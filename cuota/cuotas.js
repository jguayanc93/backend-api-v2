require('dotenv').config();
const {auditar} = require('../funciones/comunes/auditoria')

const express = require('express');
// const multer= require('multer')
const router = express.Router();
// const upload = multer();
///////ESPACIO PARA FUNCIONES GENERALES SI TUVIERA 0 REQUIERA
const {objevacio} = require('../funciones/objvacio')
//////ESPACIO PARA FUNCIONES DE COMPROBACION PARA LOS QUERYS
const {cuota_permisos} = require('../funciones/cuota/permisos')
const {cuota_revisar} = require('../funciones/cuota/revisar')
const {cuota_registrar} = require('../funciones/cuota/registrar')
const {cuota_direccionador} = require('../funciones/cuota/mostrar')
const {cuota_cobertura} = require('../funciones/cuota/cobertura')
const {cuota_cartera} = require('../funciones/cuota/cartera')
const {cuota_simple} = require('../funciones/cuota/simple')
const {ver_cuota_marcas, fijar_meta_marca} = require('../funciones/cuota/marcas_meta')
const {exigirPermiso} = require('../funciones/comunes/auth')

router.use(express.json());

//////TENDRAS QUE LANSAR RUTAS ALTERNAS PARA CADA TIPO DE VENDEDOR
router.get('/',objevacio,cuota_permisos)
// router.get('/',(req,res)=>{res.status(200).send("deberia enviarte al login de nuevo por no tener galletas")})
////////////REVISA PORQE ESTE COTIZACION DA PROBLEMAS 009-00910388 CUANDO SE LE PIDE QUE TRAIGA SUS PROMOCIONES
router.get('/simple',cuota_simple)
// router.get('/superior',)
/////estas rutas son para sus respectivos accesos segun pueda o no
router.get('/revisar',cuota_revisar)
router.post('/update',auditar('cuota','registrar'),cuota_registrar)
router.get('/mostrar',cuota_direccionador)
/////mandalos a sus respectivas rutas
router.get('/cobertura',cuota_cobertura)
router.get('/cartera',cuota_cartera)

/////Cuota por marca del grupo 25 (especialistas y jefaturas): ver la meta y el avance de sus
/////marcas del mes y fijar la meta. Contrato: docs/cuota-grupo25.md
/////Reemplaza a /especialista, /multiple, /marcarevisar, /marcaupdate y /marcamostrar, que se
/////retiraron el 2026-10-21 (guardaban la meta en tbl01api_jefaturas_meta y buscaban la marca
/////por texto).
router.get('/marcas',exigirPermiso('cuota','marcas'),ver_cuota_marcas)
router.post('/marcas/meta',auditar('cuota','meta marca'),exigirPermiso('cuota','meta marca'),fijar_meta_marca)

module.exports=router