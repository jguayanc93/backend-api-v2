require('dotenv').config();

const express = require('express');
const router = express.Router();
//////ESPACIO PARA FUNCIONES DE COMPROBACION PARA LOS QUERYS
const {exigirPermiso} = require('../funciones/comunes/auth')
const {avance_zona, probabilidad_zona} = require('../funciones/zona/zona')

router.use(express.json());

/////Jefe de zona (grupo 34): avance de cuota de todo el grupo 20 y probabilidad de que un
/////vendedor llegue a su cuota. Solo lectura. Contrato: docs/zona-grupo34.md
router.get('/avance',exigirPermiso('zona','avance'),avance_zona)
router.get('/probabilidad',exigirPermiso('zona','probabilidad'),probabilidad_zona)

module.exports=router
