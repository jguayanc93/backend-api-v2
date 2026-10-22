const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, perfil, mesAnterior, soloLectura} = require('./comun')

/////Mis marcas del mes pasado, para que la pantalla precargue el borrador ("mantener las
/////del mes anterior"). Cada una dice si este mes se puede volver a tomar y, si no, por que.
/////No asigna nada: lo que el usuario deje en el borrador se manda a /marcas/confirmar.
let marcas_anterior = (resolve,reject,conexion,galleta)=>{
    const codusu = texto(galleta ? galleta.identificador : null);
    if(!codusu){ conexion.close(); return reject("falsa galleta"); }

    soloLectura(resolve, reject, conexion, 'marcas anterior', async ()=>{
        const yo = await perfil(conexion, codusu, false);
        /////sin registro en la intranet no hay rol: lo mismo que responde /login/identificador
        if(!yo.tipo && !yo.familia) return {rechazo:"no identificado"};
        const antes = mesAnterior(yo.anno, yo.mes);

        const r = await ejecutar(conexion,
            `select a.codmar, rtrim(m.abrmar), rtrim(m.Nommar), e.codfam, e.trabajada,
                    rtrim(ahora.codusu), rtrim(u.nomusu)
             from tbl01_api_marcas_asignadas a
             join tbl01mar m on m.codmar=a.codmar
             left join tbl01_api_marcas_estado e on e.codmar=a.codmar
             left join tbl01_api_marcas_asignadas ahora
                    on ahora.anno=@anno and ahora.mes=@mes and ahora.codmar=a.codmar
             left join fcu0000 u on u.codusu=ahora.codusu
             where a.anno=@anno_antes and a.mes=@mes_antes and a.codusu=@codusu
             order by m.Nommar`,
            [{nombre:'anno',tipo:TYPES.Int,valor:yo.anno},
             {nombre:'mes',tipo:TYPES.Int,valor:yo.mes},
             {nombre:'anno_antes',tipo:TYPES.Int,valor:antes.anno},
             {nombre:'mes_antes',tipo:TYPES.Int,valor:antes.mes},
             {nombre:'codusu',tipo:TYPES.VarChar,valor:codusu}]);

        const marcas = r.rows.map(f=>{
            const codfam = texto(f[3].value);
            const dueno = texto(f[5].value);
            let motivo = null;
            if(codfam == null)                          motivo = "la marca no esta en el catalogo de marcas";
            else if(f[4].value === false)               motivo = "la marca ya no se trabaja";
            else if(dueno && dueno !== codusu)          motivo = "la marca ya esta asignada a otro este mes";
            else if(yo.familia && codfam !== yo.familia) motivo = "la marca no es de la familia de su jefatura";
            return {
                codmar: texto(f[0].value),
                abrmar: texto(f[1].value),
                nombre: texto(f[2].value),
                disponible: motivo == null,
                motivo: motivo,
                asignadaA: dueno && dueno !== codusu ? (texto(f[6].value) || dueno) : null
            };
        });

        return {anno:antes.anno, mes:antes.mes, marcas:marcas};
    });
}

module.exports={marcas_anterior}
