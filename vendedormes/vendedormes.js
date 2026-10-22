require('dotenv').config();

const express = require('express');
const router = express.Router();
//////ESPACIO PARA FUNCIONES DE COMPROBACION PARA LOS QUERYS
const {exigirPermiso} = require('../funciones/comunes/auth')
const {top_vendedormes} = require('../funciones/vendedormes/top')

router.use(express.json());

/////Vendedor del mes (grupo 25): los 3 vendedores del grupo 20 que mas venden cada marca.
/////Solo lectura. Contrato: docs/vendedor-mes-grupo25.md
router.get('/top',exigirPermiso('vendedormes','ver'),top_vendedormes)

module.exports=router
