require('dotenv').config();
const {TYPES} = require('../../conexion/cadena')
const {TIPOS_POR_GRUPO} = require('../../funciones/comunes/constantes')
const {ejecutar, texto, leerMarcas, perfil, tomarMarcas, marcarConfirmado, enTransaccion} = require('../marcas/comun')

/////Registra al usuario en tbl_api_vendedores_diferenciador y, si es del grupo 25, le
/////asigna para el mes en curso las marcas que eligio. Todo dentro de una transaccion:
/////o queda registrado con sus marcas, o no queda nada.
/////
/////Reglas del grupo 25:
/////  - si su codusu esta en tbl01_api_jefatura_familia es JEFATURA, elija lo que elija
/////  - si no esta ahi y pide JEFATURA se rechaza: primero hay que cargarle su familia
/////  - las marcas que no se le pueden dar se saltan y se devuelven con el motivo
/////  - elegir marcas al registrarse es su confirmacion del mes: quedan fijas hasta el
/////    mes siguiente, igual que con /marcas/confirmar. Si se registra sin marcas, las
/////    confirma despues por esa ruta.

const GRUPO_MARCAS = 25;

/////Que diferenciador le toca. Devuelve {tipo} o {error} con el motivo para error_corrector.
function decidirTipo(grupo, pedido, familiaJefe){
    const permitidos = TIPOS_POR_GRUPO[grupo];
    if(!permitidos) return {error:"diferenciador invalido"};

    if(grupo === GRUPO_MARCAS){
        if(familiaJefe) return {tipo:'JEFATURA'};
        if(pedido === 'JEFATURA') return {error:"jefatura sin familia"};
    }
    if(!permitidos.includes(pedido)) return {error:"diferenciador invalido"};
    return {tipo:pedido};
}

let logeo_registro = (resolve,reject,payload,conexion,req)=>{
    const cuerpo = req.body || {};
    const codusu = texto(payload ? payload.identificador : null);
    const grupo = parseInt(payload ? payload.id_grupo : NaN);
    const pedido = String(cuerpo.diferenciador == null ? '' : cuerpo.diferenciador).trim().toUpperCase();
    const codigos = leerMarcas(cuerpo.marcas);

    if(!codusu){ conexion.close(); return reject("falsa galleta"); }
    if(codigos === null){ conexion.close(); return reject("marcas invalidas"); }

    enTransaccion(resolve, reject, conexion, 'registro', async ()=>{
        /////1) que no este registrado ya. La tabla no tiene clave primaria y asi fue como
        /////   se duplico V0206: un segundo envio del formulario volvia a insertar.
        const previo = await ejecutar(conexion,
            "select top 1 diferenciador from tbl_api_vendedores_diferenciador with (updlock, holdlock) where codusu=@codusu",
            [{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu}]);
        if(previo.rows.length > 0) return {rechazo:"usuario ya registrado"};

        /////2) que tipo le corresponde
        const yo = await perfil(conexion, codusu, true);
        const decision = decidirTipo(grupo, pedido, yo.familia);
        if(decision.error) return {rechazo:decision.error};

        /////3) el registro
        await ejecutar(conexion,
            "INSERT INTO tbl_api_vendedores_diferenciador(codven,nombre,diferenciador,codgru,codusu) VALUES(@codven,@nombre,@tipo,@grupo,@id)",
            [{nombre:'codven',tipo:TYPES.VarChar,valor:payload.codigo},
             {nombre:'nombre',tipo:TYPES.VarChar,valor:payload.nombre},
             {nombre:'tipo',tipo:TYPES.VarChar,valor:decision.tipo},
             {nombre:'grupo',tipo:TYPES.Int,valor:grupo},
             {nombre:'id',tipo:TYPES.VarChar,valor:codusu}]);

        /////4) las marcas: solo el grupo 25 trabaja con marcas
        let marcas = {asignadas:[], omitidas:[]};
        let confirmado = false;
        if(grupo === GRUPO_MARCAS && codigos.length > 0){
            const tomadas = await tomarMarcas(conexion, yo, codigos);
            marcas = {asignadas:tomadas.asignadas, omitidas:tomadas.omitidas};
            if(tomadas.asignadas.length > 0){
                await marcarConfirmado(conexion, yo.anno, yo.mes, codusu);
                confirmado = true;
            }
        }

        /////marcas y confirmado solo existen para el grupo 25: la pantalla muestra el resultado
        /////de las marcas solo si vienen, y a los demas grupos los manda directo al panel
        if(grupo !== GRUPO_MARCAS) return {tipo:decision.tipo};
        return {tipo:decision.tipo, marcas:marcas, confirmado:confirmado};
    });
}

module.exports={logeo_registro}
