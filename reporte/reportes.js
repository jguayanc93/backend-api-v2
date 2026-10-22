require('dotenv').config();

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
const {marcas_reporte, stock_reporte, tiempo_reporte, precios_reporte, guias_reporte} = require('../funciones/reportes/informes')
const {exigirPermiso} = require('../funciones/comunes/auth')

router.use(express.json());

//////TENDRAS QUE LANSAR RUTAS ALTERNAS PARA CADA TIPO DE VENDEDOR
router.get('/',objevacio,coti_permisos)

/////Reportes por marca del grupo 25, por codmar y en JSON o Excel.
/////El contrato para la pantalla esta en docs/reportes-grupo25.md
router.get('/marca',exigirPermiso('reporte','marcas'),marcas_reporte)
router.post('/marca/stock',exigirPermiso('reporte','stock'),stock_reporte)
router.post('/marca/tiempo',exigirPermiso('reporte','tiempo'),tiempo_reporte)
router.post('/marca/precios',exigirPermiso('reporte','precio'),precios_reporte)
router.post('/marca/guias',exigirPermiso('reporte','guias'),guias_reporte)

/////Las rutas de la pantalla antigua (/marcas, /stoc, /precios, /tiempo: marca por texto y solo
/////descarga) se retiraron el 2026-10-21. /tiempo ademas no veia las compras de 2026.

module.exports=router