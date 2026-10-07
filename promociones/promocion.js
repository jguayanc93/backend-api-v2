const {auditar} = require('../funciones/comunes/auditoria')
const express = require('express');
const router = express.Router();
///////ESPACIO PARA FUNCIONES GENERALES SI TUVIERA 0 REQUIERA
const {objevacio} = require('../funciones/objvacio')
const {exigirSesion, exigirPermiso} = require('../funciones/comunes/auth')
//////ESPACIO PARA FUNCIONES DE COMPROBACION PARA LOS QUERYS
const {promo_permisos} = require('../funciones/promocion/permisos')

const {prom_buscar} = require('../funciones/promocion/buscar')
const {prom_analisar} = require('../funciones/promocion/mostrar')
const {prom_adjuntar} = require('../funciones/promocion/analisar')
const {prom_acoplar} = require('../funciones/promocion/adjuntar')
const {prom_remover} = require('../funciones/promocion/remover')
//////////////
const {prom_buscar_paso1} = require('../funciones/promocion/simple_buscador_paso1')
const {prom_temporal_mejorada} = require('../funciones/promocion/simulacion_prom')

router.use(express.json());

router.get('/',objevacio,promo_permisos)

/////la sesion se valida aca, no dentro de cada handler.
/////antes cada uno repetia galleta_credencial y /detalle no la tenia del todo.
router.use(exigirSesion);

/////lectura: basta con tener sesion valida
router.post('/recolector',prom_buscar_paso1)
router.post('/detalle',prom_temporal_mejorada)
router.post('/revisar',prom_buscar)
router.post('/mostrar',prom_analisar,prom_adjuntar)

/////escritura sobre la cotizacion: ademas se exige el permiso del grupo
router.post('/acoplar',auditar('promocion','acoplar'),exigirPermiso('promocion','update'),prom_acoplar)
router.post('/eliminar',auditar('promocion','retirar'),exigirPermiso('promocion','delete cotizacion'),prom_remover)

module.exports=router
