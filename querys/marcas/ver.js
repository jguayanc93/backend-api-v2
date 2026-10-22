const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, perfil, soloLectura} = require('./comun')

/////Lo que la pantalla de marcas necesita para pintarse:
/////  - mis marcas del mes y si ya las confirme
/////  - si soy jefatura: todas las marcas de mi familia (se trabajen o no) con su dueño,
/////    y los especialistas con cuantas marcas de mi familia llevan y si ya confirmaron
let marcas_ver = (resolve,reject,conexion,galleta)=>{
    const codusu = texto(galleta ? galleta.identificador : null);
    if(!codusu){ conexion.close(); return reject("falsa galleta"); }

    soloLectura(resolve, reject, conexion, 'marcas ver', async ()=>{
        const yo = await perfil(conexion, codusu, false);
        /////sin registro en la intranet no hay rol: lo mismo que responde /login/identificador
        if(!yo.tipo && !yo.familia) return {rechazo:"no identificado"};
        const mes = [{nombre:'anno',tipo:TYPES.Int,valor:yo.anno},{nombre:'mes',tipo:TYPES.Int,valor:yo.mes}];

        const mias = await ejecutar(conexion,
            `select a.codmar, rtrim(m.abrmar), rtrim(m.Nommar), e.codfam, rtrim(f.nomfam), e.trabajada,
                    rtrim(a.asignado_por), rtrim(u.nomusu)
             from tbl01_api_marcas_asignadas a
             join tbl01mar m on m.codmar=a.codmar
             left join tbl01_api_marcas_estado e on e.codmar=a.codmar
             left join tbl01fam f on f.codfam=e.codfam
             left join fcu0000 u on u.codusu=a.asignado_por
             where a.anno=@anno and a.mes=@mes and a.codusu=@codusu
             order by m.Nommar`,
            mes.concat([{nombre:'codusu',tipo:TYPES.VarChar,valor:codusu}]));

        const respuesta = {
            anno: yo.anno,
            mes: yo.mes,
            rol: yo.rol,
            confirmado: yo.confirmadoEn != null,
            confirmadoEn: yo.confirmadoEn,
            marcas: mias.rows.map(f=>({
                codmar: texto(f[0].value),
                abrmar: texto(f[1].value),
                nombre: texto(f[2].value),
                codfam: texto(f[3].value),
                familia: texto(f[4].value),
                trabajada: f[5].value !== false,
                asignadaPor: texto(f[6].value) === codusu ? 'yo' : (texto(f[7].value) || texto(f[6].value))
            })),
            familia: null
        };

        if(yo.rol !== 'JEFATURA' || !yo.familia) return respuesta;

        const fam = mes.concat([{nombre:'codfam',tipo:TYPES.Char,valor:yo.familia}]);

        const catalogo = await ejecutar(conexion,
            `select e.codmar, rtrim(m.abrmar), rtrim(m.Nommar), e.trabajada,
                    rtrim(a.codusu), rtrim(u.nomusu)
             from tbl01_api_marcas_estado e
             join tbl01mar m on m.codmar=e.codmar
             left join tbl01_api_marcas_asignadas a on a.anno=@anno and a.mes=@mes and a.codmar=e.codmar
             left join fcu0000 u on u.codusu=a.codusu
             where e.codfam=@codfam
             order by e.trabajada desc, m.Nommar`,
            fam);

        const especialistas = await ejecutar(conexion,
            `select d.codusu, d.nombre,
                    (select count(*) from tbl01_api_marcas_asignadas a
                     join tbl01_api_marcas_estado e on e.codmar=a.codmar
                     where a.anno=@anno and a.mes=@mes and a.codusu=d.codusu and e.codfam=@codfam),
                    (select count(*) from tbl01_api_marcas_asignadas a
                     where a.anno=@anno and a.mes=@mes and a.codusu=d.codusu),
                    case when exists(select 1 from tbl01_api_marcas_confirmadas c
                                     where c.anno=@anno and c.mes=@mes and c.codusu=d.codusu) then 1 else 0 end
             -- el nombre sale de fcu0000, como en el resto de rutas de marcas y reportes:
             -- el de la tabla de diferenciadores esta escrito distinto (nombre y apellido al reves)
             from (select distinct rtrim(x.codusu) codusu, rtrim(isnull(u.nomusu, x.nombre)) nombre
                   from tbl_api_vendedores_diferenciador x
                   left join fcu0000 u on u.codusu=rtrim(x.codusu)
                   where x.codgru=25 and rtrim(x.diferenciador)='ESPECIALISTA') d
             order by d.nombre`,
            fam);

        respuesta.familia = {
            codfam: yo.familia,
            nombre: yo.nombreFamilia,
            marcas: catalogo.rows.map(f=>{
                const dueno = texto(f[4].value);
                return {
                    codmar: texto(f[0].value),
                    abrmar: texto(f[1].value),
                    nombre: texto(f[2].value),
                    trabajada: f[3].value !== false,
                    dueno: dueno ? {codusu:dueno, nombre:texto(f[5].value), soyYo: dueno === codusu} : null
                };
            }),
            especialistas: especialistas.rows.map(f=>({
                codusu: texto(f[0].value),
                nombre: texto(f[1].value),
                marcasDeMiFamilia: f[2].value,
                marcasTotal: f[3].value,
                confirmado: f[4].value === 1
            }))
        };
        return respuesta;
    });
}

module.exports={marcas_ver}
