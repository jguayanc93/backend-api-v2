const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, leerMarcas, perfil, tomarMarcas, marcarConfirmado, enTransaccion} = require('./comun')

/////El especialista o la jefatura confirma sus marcas del mes. Cuerpo: {"marcas":["0206","0008"]}.
/////
/////El borrador vive en la pantalla: aqui llega la lista final una sola vez. Se asignan
/////las que se pueden, se saltan las que no (con su motivo) y el usuario queda confirmado:
/////ya no puede sumar ni quitar marcas propias hasta el mes siguiente.
/////
/////Las marcas que la jefatura ya le habia dado se conservan aunque no vengan en la lista.
/////Si al final no le queda ninguna marca, no se confirma: puede volver a intentarlo.
let marcas_confirmar = (resolve,reject,conexion,galleta,cuerpo)=>{
    const codusu = texto(galleta ? galleta.identificador : null);
    if(!codusu){ conexion.close(); return reject("falsa galleta"); }
    const codigos = leerMarcas(cuerpo ? cuerpo.marcas : null);
    if(codigos === null){ conexion.close(); return reject("marcas invalidas"); }

    enTransaccion(resolve, reject, conexion, 'marcas confirmar', async ()=>{
        const yo = await perfil(conexion, codusu, true);
        /////sin registro en la intranet no hay rol: lo mismo que responde /login/identificador
        if(!yo.tipo && !yo.familia) return {rechazo:"no identificado"};
        if(yo.rol === 'JEFATURA' && !yo.familia) return {rechazo:"jefatura sin familia"};
        if(yo.rol !== 'JEFATURA' && yo.rol !== 'ESPECIALISTA') return {rechazo:"sin permiso"};
        if(yo.confirmadoEn) return {rechazo:"marcas ya confirmadas"};

        const tomadas = await tomarMarcas(conexion, yo, codigos);

        const total = await ejecutar(conexion,
            "select count(*) from tbl01_api_marcas_asignadas where anno=@anno and mes=@mes and codusu=@codusu",
            [{nombre:'anno',tipo:TYPES.Int,valor:yo.anno},
             {nombre:'mes',tipo:TYPES.Int,valor:yo.mes},
             {nombre:'codusu',tipo:TYPES.VarChar,valor:codusu}]);
        const cuantas = total.rows[0][0].value;

        if(cuantas > 0) await marcarConfirmado(conexion, yo.anno, yo.mes, codusu);

        return {
            confirmado: cuantas > 0,
            anno: yo.anno, mes: yo.mes,
            total: cuantas,
            asignadas: tomadas.asignadas,
            yaTenia: tomadas.yaTenia,
            omitidas: tomadas.omitidas
        };
    });
}

module.exports={marcas_confirmar}
