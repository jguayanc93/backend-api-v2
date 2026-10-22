require('dotenv').config();

const express = require('express');
const router = express.Router();
//////ESPACIO PARA FUNCIONES DE COMPROBACION PARA LOS QUERYS
const {exigirPermiso} = require('../funciones/comunes/auth')
const {marcas_cobertura, clientes_cobertura} = require('../funciones/cobertura/clientes')

router.use(express.json());

/////Cobertura de clientes del grupo 25 (especialistas y jefaturas): a que clientes se les vendio
/////cada marca en el mes. No es la cuota de los vendedores de cobertura del grupo 20
/////(/cuota/cobertura). Contrato: docs/cobertura-grupo25.md
router.get('/marcas',exigirPermiso('cobertura','clientes'),marcas_cobertura)
router.get('/clientes',exigirPermiso('cobertura','clientes'),clientes_cobertura)

module.exports=router
