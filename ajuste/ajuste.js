require('dotenv').config();
const {auditar} = require('../funciones/comunes/auditoria')

const express = require('express');
const router = express.Router();
//////ESPACIO PARA FUNCIONES DE COMPROBACION PARA LOS QUERYS
const {exigirPermiso} = require('../funciones/comunes/auth')
const {accesos_ajuste, previa_ajuste, enviar_ajuste, enviadas_ajuste, recibidas_ajuste, solicitud_ajuste,
       confirmar_ajuste, rechazar_ajuste} = require('../funciones/ajuste/ajuste')

router.use(express.json());

/////Ajuste de precio de cotizaciones y pedidos. Contrato: docs/ajuste-precios.md
/////las acciones que puede usar su grupo
router.get('/',accesos_ajuste)
/////el vendedor (grupo 20) envia y ve sus solicitudes
router.post('/previa',exigirPermiso('ajuste','enviar'),previa_ajuste)
router.post('/enviar',auditar('ajuste','enviar'),exigirPermiso('ajuste','enviar'),enviar_ajuste)
router.get('/enviadas',exigirPermiso('ajuste','enviadas'),enviadas_ajuste)
/////el especialista o la jefatura (grupo 25) recibe y responde
router.get('/recibidas',exigirPermiso('ajuste','recibidas'),recibidas_ajuste)
router.get('/solicitud',exigirPermiso('ajuste','recibidas'),solicitud_ajuste)
router.post('/confirmar',auditar('ajuste','confirmar'),exigirPermiso('ajuste','recibidas'),confirmar_ajuste)
router.post('/rechazar',auditar('ajuste','rechazar'),exigirPermiso('ajuste','recibidas'),rechazar_ajuste)

module.exports=router
