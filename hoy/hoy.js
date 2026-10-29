require('dotenv').config();

const express = require('express');
const router = express.Router();
//////ESPACIO PARA FUNCIONES DE COMPROBACION PARA LOS QUERYS
const {exigirPermiso} = require('../funciones/comunes/auth')
const {quienvender} = require('../funciones/hoy/quienvender')

router.use(express.json());

/////¿A quien vender hoy? (grupo 20, 2026-10-29): 3 clientes por dia, 2 para reponer y 1 para llamar.
/////Se graba lo sugerido en tbl_api_quienvender, que no es la auditoria. Contrato: docs/quienvender-grupo20.md
router.get('/',exigirPermiso('quienvender','ver'),quienvender)

module.exports=router
