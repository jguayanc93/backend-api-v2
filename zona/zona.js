require('dotenv').config();

const express = require('express');
const router = express.Router();
//////ESPACIO PARA FUNCIONES DE COMPROBACION PARA LOS QUERYS
const {exigirPermiso} = require('../funciones/comunes/auth')
const {avance_zona, probabilidad_zona, cartera_zona, cobertura_zona} = require('../funciones/zona/zona')

router.use(express.json());

/////Jefe de zona (grupo 34): avance de cuota de todo el grupo 20, probabilidad de que un
/////vendedor llegue a su cuota, y los clientes de cada vendedor (cartera o cobertura).
/////Solo lectura. Contrato: docs/zona-grupo34.md
router.get('/avance',exigirPermiso('zona','avance'),avance_zona)
router.get('/probabilidad',exigirPermiso('zona','probabilidad'),probabilidad_zona)
router.get('/cartera',exigirPermiso('zona','cartera'),cartera_zona)
router.get('/cobertura',exigirPermiso('zona','cobertura'),cobertura_zona)

module.exports=router
