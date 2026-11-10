require('dotenv').config();
const {auditar} = require('../funciones/comunes/auditoria')

const express = require('express');
const router = express.Router();
//////ESPACIO PARA FUNCIONES DE COMPROBACION PARA LOS QUERYS
const {exigirPermiso} = require('../funciones/comunes/auth')
const {accesos_ajuste, previa_ajuste, enviar_ajuste, enviadas_ajuste, recibidas_ajuste, solicitud_ajuste,
       confirmar_ajuste, rechazar_ajuste, directo_documentos, directo_documento, directo_aplicar,
       directo_vendedores, directo_asignar, asignados_ajuste} = require('../funciones/ajuste/ajuste')

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
/////el jefe de marca (grupo 25) ajusta el precio de sus propios documentos y los asigna a un
/////vendedor del grupo 20. Contrato: docs/ajuste-directo.md
router.get('/directo/documentos',exigirPermiso('ajuste','directo'),directo_documentos)
router.get('/directo/documento',exigirPermiso('ajuste','directo'),directo_documento)
router.post('/directo/aplicar',auditar('ajuste','directo'),exigirPermiso('ajuste','directo'),directo_aplicar)
router.get('/directo/vendedores',exigirPermiso('ajuste','directo'),directo_vendedores)
router.post('/directo/asignar',auditar('ajuste','asignar'),exigirPermiso('ajuste','directo'),directo_asignar)
router.get('/asignados',exigirPermiso('ajuste','asignados'),asignados_ajuste)

module.exports=router
