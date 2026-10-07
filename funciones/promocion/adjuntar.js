const {conn} = require('../../conexion/cnn')
/////////espacio para la llamada de los querys
let {coti_detallado} = require('../../querys/promocion/prom_buscar_cabecera')
let {promocion_id} = require('../../querys/promocion/promocion_id')
let {prom_buscar_detallado} = require('../../querys/promocion/prom_buscar_detallado')
const tx = require('../../querys/promocion/acoplar_transaccion')
///////ESPACIO PARA FUNCIONES GENERALES
const motor = require('./motor')
const {haciaMemoria, sinCerrar} = require('./destino')
let descuento = require('./descuento')
let bonificacion = require('./bonificacion')
const {normalizarNdocu} = require('../comunes/constantes')
////ESPACIO PARA LOS MANEJOS DE ERRORES CON RESPUESTA
const {error_corrector} = require('../error/err1')

/////Acopla una promocion a una cotizacion ya creada: revisa si le corresponde y, de ser
/////asi, inserta sus lineas y recalcula la cabecera.
/////
/////El cuerpo solo trae {ndocu, nprom}: las lineas y los montos los calcula el servidor
/////con el mismo motor que usa /mostrar. Antes venian armadas desde el frontend y se
/////insertaban tal cual, con lo que se podia meter cualquier producto a cualquier precio.
async function prom_acoplar(req,res,next) {
    const documento = normalizarNdocu(req.body ? req.body.ndocu : null);
    const nprom = req.body ? req.body.nprom : null;

    if(documento===null) return error_corrector(res,"documento ambiguo");
    if(!nprom) return error_corrector(res,"promocion no registrada");

    let conexion;
    let abierta=false;
    try{
        conexion = await obtenerpromesa_conexion();
        await tx.iniciar(conexion);
        abierta=true;

        /////1) la cotizacion tiene que ser de este vendedor y seguir abierta
        if(!await tx.validar(conexion, documento, req.usuario ? req.usuario.codigo : null)){
            return await abortar(conexion, res, "coti no modificable", ()=>abierta=false);
        }

        /////2) estado actual de la cotizacion y definicion de la promocion
        const cuerpo = {ncoti:documento, nprom:nprom};
        /////estos querys cierran la conexion al terminar, lo que la devolveria al pool
        /////y abortaria la transaccion: se les presta con un close() inocuo
        const prestada = sinCerrar(conexion);
        const detalle_coti = await promesa(coti_detallado, prestada, cuerpo);
        const cabecera_promo = await promesa(promocion_id, prestada, cuerpo);
        const detalle_promo = await promesa(prom_buscar_detallado, prestada, cuerpo);

        const promo = motor.clasificar(cabecera_promo);

        /////3) evaluar con el motor: mismo calculo que muestra /mostrar
        const resultado = motor.evaluar({
            promo, origen:'bd', nprom:nprom,
            cotdetalle: detalle_coti, promcabesa: cabecera_promo, promdetalle: detalle_promo,
            tipopromo: [promo.venta, promo.descuento, promo.otorga], tipometrica: promo.metrica
        });

        if(!motor.hayResultado(resultado)){
            return await abortar(conexion, res, "no promo aplicable", ()=>abierta=false);
        }

        /////4) construir las lineas. El destino recolecta en memoria en vez de responder.
        const caja = haciaMemoria();
        const ejes = [promo.venta, promo.descuento, promo.otorga];
        if(motor.esDescuento(promo)){
            descuento(caja, nprom, detalle_coti, cabecera_promo, detalle_promo, ejes, promo.metrica, resultado, promo);
        }
        else{
            /////bonificacion consulta los items de regalo: se le presta la conexion de la
            /////transaccion con un close() inocuo, para que no la devuelva al pool
            bonificacion(caja, nprom, detalle_coti, cabecera_promo, detalle_promo, ejes, promo.metrica,
                         resultado, prestada, promo);
        }
        const construido = await caja.esperar();

        /////5) insertar solo lo que de verdad son lineas de promocion
        const lineas = aplanar(construido);
        if(lineas.length===0){
            /////la promocion SI aplicaba: si no quedo ninguna linea es porque el obsequio
            /////se topo contra el stock. Decirlo, en vez de "no aplica", que confunde.
            const motivo = motor.esDescuento(promo) ? "no promo aplicable" : "obsequio sin stock";
            return await abortar(conexion, res, motivo, ()=>abierta=false);
        }
        for(const linea of lineas){
            if(!tx.esLineaDePromocion(linea)){
                return await abortar(conexion, res, "promocion no registrada", ()=>abierta=false);
            }
            await tx.insertarLinea(conexion, linea);
        }

        /////6) recalcular la cabecera desde el detalle ya actualizado
        const cab = await tx.recalcularCabecera(conexion, documento);
        if(cab.afectadas===0){
            return await abortar(conexion, res, "coti no modificable", ()=>abierta=false);
        }

        await tx.confirmar(conexion); abierta=false;
        conexion.close();
        res.status(200).json({"status":"ok","codigo":0,"msg":"promocion acoplada",
                              "documento":documento,"lineas":lineas.length,
                              "totales":{"tota":cab.tota,"toti":cab.toti,"totn":cab.totn}});
    }
    catch(err){
        console.error('[promocion] fallo al acoplar',nprom,'en',documento,err);
        if(abierta){ try{ await tx.revertir(conexion); }catch(e){} }
        if(conexion){ try{ conexion.close(); }catch(e){} }
        error_corrector(res, typeof err==='string' ? err : "error query");
    }
}

async function abortar(conexion,res,mensaje,marcar){
    await tx.revertir(conexion); marcar();
    conexion.close();
    error_corrector(res,mensaje);
}

function obtenerpromesa_conexion(){ return new Promise((resolve,reject)=>conn(resolve,reject)) }
function promesa(fn,conexion,cuerpo){ return new Promise((resolve,reject)=>fn(resolve,reject,conexion,cuerpo)) }

/////lo construido viene como objeto de lineas, a veces con claves sueltas ("descuento")
/////o con arreglos anidados por item; aqui se deja una lista plana de lineas
function aplanar(construido){
    const lineas=[];
    for(const k in construido){
        if(k==='descuento') continue;            ////bloque de totales, no es una linea
        const v=construido[k];
        if(!Array.isArray(v)) continue;
        if(v.length===0) continue;                 ////promo que no genero ninguna linea
        if(Array.isArray(v[0])) v.forEach(sub=>{ if(Array.isArray(sub)) lineas.push(sub); });
        else lineas.push(v);
    }
    return lineas;
}

module.exports={prom_acoplar}
