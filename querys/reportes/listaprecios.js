const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, soloLectura} = require('../marcas/comun')
const {FAMILIAS_LISTA_PRECIOS} = require('../../funciones/comunes/constantes')
const {linea} = require('../../funciones/comunes/importes')

/////Lista de precios del grupo 20 (decidido el 2026-10-28). Es para que el vendedor la pase o la
/////muestre a sus clientes, asi que no lleva nada interno:
/////  - ni costo ni stock: la columna de disponibilidad dice lo mismo en todas las filas
/////  - ni codigos del sistema
/////  - todos los vigentes de las familias habilitadas que tengan precio, haya o no stock; si solo
/////    salieran los que tienen stock, la hoja delataria el stock
/////  - precio de lista del almacen principal (prd0101), en dolares y sin IGV, antes del descuento
/////    por tipo de cliente. El de M&M no se muestra: cambia en cerca de la mitad de los productos
/////  - la marca, tal cual esta en tbl01mar (algunas llevan la linea: HP-IMPRESORAS, EP_IMPRESORAS)
/////Las familias habilitadas son FAMILIAS_LISTA_PRECIOS (funciones/comunes/constantes.js).

const DISPONIBILIDAD = 'SUJETO A DISPONIBILIDAD';

const COLUMNAS = [
    {campo:'descripcion',     titulo:'DESCRIPCION'},
    {campo:'partNumber',      titulo:'PART NUMBER'},
    {campo:'marca',           titulo:'MARCA'},
    {campo:'familia',         titulo:'FAMILIA'},
    {campo:'precioSinIgv',    titulo:'PRECIO SIN IGV US$'},
    {campo:'precioConIgv',    titulo:'PRECIO CON IGV US$'},
    {campo:'disponibilidad',  titulo:'DISPONIBILIDAD'}
];

/////POST /reporte/listaprecios
let listaprecios_reporte = (resolve,reject,conexion,galleta)=>{
    soloLectura(resolve, reject, conexion, 'lista de precios', async ()=>{
        const parametros = FAMILIAS_LISTA_PRECIOS.map((f,i)=>({nombre:`f${i}`, tipo:TYPES.Char, valor:f}));
        /////b.mone='D': todos los precios del almacen principal estan en dolares; si algun dia
        /////uno viniera en otra moneda, es mejor que falte a que salga rotulado US$ sin serlo
        const r = await ejecutar(conexion,
            `select rtrim(b.descr), rtrim(b.Usr_001), rtrim(m.Nommar), rtrim(f.nomfam), b.vvus
             from prd0101 b
             left join tbl01fam f on f.codfam=LEFT(b.codi,2)
             left join tbl01mar m on m.codmar=b.codmar
             where b.estado=1 and b.mone='D' and b.vvus>0
               and LEFT(b.codi,2) in (${parametros.map(p=>'@'+p.nombre).join(',')})
             order by f.nomfam, m.Nommar, b.descr`,
            parametros);
        const hoy = await ejecutar(conexion, `select convert(char(10), getdate(), 23)`, []);

        /////el precio con IGV sale del precio sin IGV que se muestra, con la regla del ERP
        /////(funciones/comunes/importes.js): quien multiplique el de la hoja por 1,18 obtiene el otro
        const filas = r.rows.map(f=>{
            const v = f.map(c=>c.value);
            const precio = linea(v[4], 1, 0);
            return {descripcion:texto(v[0]) || '', partNumber:texto(v[1]) || '', marca:texto(v[2]) || '',
                    familia:texto(v[3]) || '', precioSinIgv:precio.conDescuento, precioConIgv:precio.totn,
                    disponibilidad:DISPONIBILIDAD};
        });
        return {
            informe: 'listaprecios',
            fecha: texto(hoy.rows[0][0].value),
            generado: new Date().toISOString(),
            columnas: COLUMNAS,
            filas: filas
        };
    });
}

module.exports={listaprecios_reporte, COLUMNAS}
