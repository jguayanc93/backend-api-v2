require('dotenv').config();

const express = require('express');
// const multer= require('multer')
const router = express.Router();
// const upload = multer();
///////ESPACIO PARA FUNCIONES GENERALES SI TUVIERA 0 REQUIERA
const {objevacio} = require('../funciones/objvacio')
//////ESPACIO PARA FUNCIONES DE COMPROBACION PARA LOS QUERYS
const {vendedor_permisos} = require('../funciones/vendedor/redirigir_tipo')
const {grupos_modulos} = require('../funciones/vendedor/cobertura_modulos')
// const {} = require('../funciones/vendedor/cartera_modulos')

router.use(express.json());

//////TENDRAS QUE LANSAR RUTAS ALTERNAS PARA CADA TIPO DE VENDEDOR
router.get('/',objevacio,vendedor_permisos)
router.get('/',(req,res)=>{res.status(200).send("deberia enviarte al login de nuevo por no tener galletas")})

router.get('/cobertura',grupos_modulos)
router.get('/cartera',grupos_modulos)
router.get('/zona',grupos_modulos)
router.get('/especialista',grupos_modulos)
/////los seis diferenciadores que existen en tbl_api_vendedores_diferenciador. Faltaban hp y
/////jefatura, asi que esos vendedores recibian un 404 al abrir el menu.
router.get('/jefatura',grupos_modulos)
router.get('/hp',grupos_modulos)

module.exports=router