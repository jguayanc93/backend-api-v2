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
const {cuota_marca_revisor_rapido} = require('../funciones/cuota/revisar_marca')
const {cuota_registrar} = require('../funciones/cuota/registrar')
const {cuota_registrar_marca} = require('../funciones/cuota/registrar_marca')
const {cuota_direccionador} = require('../funciones/cuota/mostrar')
const {cuota_cobertura} = require('../funciones/cuota/cobertura')
const {cuota_cartera} = require('../funciones/cuota/cartera')
const {cuota_especialista} = require('../funciones/cuota/especialista')
// const {} = require('../funciones/cuota/jefatura')
const {cuota_simple} = require('../funciones/cuota/simple')
const {cuota_multiple} = require('../funciones/cuota/multiple')

const {cuota_marca_dinamica} = require('../funciones/cuota/marca')

router.use(express.json());

//////TENDRAS QUE LANSAR RUTAS ALTERNAS PARA CADA TIPO DE VENDEDOR
router.get('/',objevacio,cuota_permisos)
// router.get('/',(req,res)=>{res.status(200).send("deberia enviarte al login de nuevo por no tener galletas")})
////////////REVISA PORQE ESTE COTIZACION DA PROBLEMAS 009-00910388 CUANDO SE LE PIDE QUE TRAIGA SUS PROMOCIONES
router.get('/simple',cuota_simple)
router.get('/multiple',cuota_multiple)
// router.get('/superior',)
/////estas rutas son para sus respectivos accesos segun pueda o no
router.get('/revisar',cuota_revisar)
router.post('/marcarevisar',cuota_marca_revisor_rapido)
router.post('/update',auditar('cuota','registrar'),cuota_registrar)
router.post('/marcaupdate',auditar('cuota','registrar marca'),cuota_registrar_marca)
router.get('/mostrar',cuota_direccionador)
router.post('/marcamostrar',cuota_marca_dinamica)
/////mandalos a sus respectivas rutas
router.get('/cobertura',cuota_cobertura)
router.get('/cartera',cuota_cartera)
router.get('/especialista',cuota_especialista)
// router.post('/jefatura')

module.exports=router