const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, perfil, soloLectura} = require('./comun')

const MAXIMO = 50;

/////Buscador de marcas libres este mes: se trabajan y nadie las tiene. Cuerpo: {"sugerencia":"eps"}.
/////Busca por nombre, abreviatura o codigo; sin sugerencia devuelve las primeras 50.
/////Al especialista le muestra todas las familias; a la jefatura solo la suya.
let marcas_disponibles = (resolve,reject,conexion,galleta,cuerpo)=>{
    const codusu = texto(galleta ? galleta.identificador : null);
    if(!codusu){ conexion.close(); return reject("falsa galleta"); }
    const sugerencia = String((cuerpo && cuerpo.sugerencia) || '').trim().slice(0,40);

    soloLectura(resolve, reject, conexion, 'marcas disponibles', async ()=>{
        const yo = await perfil(conexion, codusu, false);
        const soloFamilia = yo.familia ? 'and e.codfam=@codfam' : '';

        const r = await ejecutar(conexion,
            `select top ${MAXIMO} e.codmar, rtrim(m.abrmar), rtrim(m.Nommar), e.codfam, rtrim(f.nomfam)
             from tbl01_api_marcas_estado e
             join tbl01mar m on m.codmar=e.codmar
             join tbl01fam f on f.codfam=e.codfam
             where e.trabajada=1 ${soloFamilia}
               and not exists(select 1 from tbl01_api_marcas_asignadas a
                              where a.anno=@anno and a.mes=@mes and a.codmar=e.codmar)
               and (@pista='%%' or m.Nommar like @pista or m.abrmar like @pista or e.codmar=@exacto)
             order by m.Nommar`,
            [{nombre:'anno',tipo:TYPES.Int,valor:yo.anno},
             {nombre:'mes',tipo:TYPES.Int,valor:yo.mes},
             {nombre:'codfam',tipo:TYPES.Char,valor:yo.familia},
             {nombre:'pista',tipo:TYPES.VarChar,valor:`%${sugerencia}%`},
             {nombre:'exacto',tipo:TYPES.VarChar,valor:sugerencia}]);

        return r.rows.map(f=>({
            codmar: texto(f[0].value),
            abrmar: texto(f[1].value),
            nombre: texto(f[2].value),
            codfam: texto(f[3].value),
            familia: texto(f[4].value)
        }));
    });
}

module.exports={marcas_disponibles}
