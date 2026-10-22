require('dotenv').config();
const {auditar} = require('../funciones/comunes/auditoria')

const express = require('express');
const router = express.Router();
//////ESPACIO PARA FUNCIONES DE COMPROBACION PARA LOS QUERYS
const {exigirPermiso} = require('../funciones/comunes/auth')
const {ver_marcas, anterior_marcas, disponibles_marcas, confirmar_marcas,
       asignar_marcas, retirar_marcas, estado_marcas} = require('../funciones/marcas/marcas')

router.use(express.json());

/////Marcas del mes del grupo 25 (jefaturas y especialistas). El contrato para la pantalla
/////esta en docs/marcas-grupo25.md
/////los dos: especialista y jefatura
router.get('/',exigirPermiso('marcas','ver'),ver_marcas)
router.get('/anterior',exigirPermiso('marcas','ver'),anterior_marcas)
router.post('/disponibles',exigirPermiso('marcas','ver'),disponibles_marcas)
router.post('/confirmar',auditar('marcas','confirmar'),exigirPermiso('marcas','confirmar'),confirmar_marcas)
/////solo jefatura: la consulta comprueba que tenga familia cargada
router.post('/asignar',auditar('marcas','asignar'),exigirPermiso('marcas','asignar'),asignar_marcas)
router.post('/retirar',auditar('marcas','retirar'),exigirPermiso('marcas','retirar'),retirar_marcas)
router.post('/estado',auditar('marcas','estado'),exigirPermiso('marcas','estado'),estado_marcas)

module.exports=router
