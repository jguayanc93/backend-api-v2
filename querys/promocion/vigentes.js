const {TYPES} = require('../../conexion/cadena')
const {ejecutar, texto, soloLectura} = require('../marcas/comun')
const {BENEFICIO} = require('../../funciones/comunes/constantes')
const {vigente} = require('./vigencia')

/////Promociones vigentes para el vendedor del grupo 20 (decidido el 2026-10-29): que hay en promocion
/////para ofrecer. Solo lectura. Contrato: docs/promovigentes-grupo20.md
/////
/////  - vigente: encendida (estado=1) y hoy entre fecini y fecfin, comparando por dia: la promocion
/////    se ve todo su ultimo dia. Es la regla de vigencia.js, la misma de los buscadores de la cotizacion
/////  - la marca y la familia salen de los productos, no del nombre: los nombres de las promociones
/////    no sirven para clasificarlas ("TCL PROMO MNT 15231 OCT26", "ALMAC. 14218 CDK 5+1 ...")
/////  - del stock solo se dice DISPONIBLE o AGOTADO: hay stock en alguno de los cuatro almacenes. Es el
/////    del producto en promocion: no se mira el obsequio de las promociones de regalo. El detalle dice
/////    ademas en cuales almacenes hay (sin cantidades)
/////  - sin montos de descuento ni costo: no los necesita el vendedor para ofrecerla
/////  - una promocion sin ningun producto vigente no sale: no hay nada que ofrecer
/////  - dtl_promocion_progra repite filas (idprom, codi): se cuenta cada producto una sola vez
/////  - la marca va tal cual esta en tbl01mar (HEWLETT PACKARD, HP-IMPRESORAS, HP-MONITORES...)

const DISPONIBLE = 'DISPONIBLE';
const AGOTADO = 'AGOTADO';

/////hay stock en el almacen: fisico menos lo separado para venta y lo pedido (igual que los reportes
/////del grupo 25, querys/reportes/informes.js)
const hay = (a)=>`(CAST(ISNULL(${a}.stoc,0) as int)-(CAST(ISNULL(${a}.svta,0) as int)+CAST(ISNULL(${a}.pedi,0) as int))>0)`;
const CON_STOCK = `(${hay('b')} or ${hay('c')} or ${hay('d')} or ${hay('e')})`;
/////los cuatro almacenes: 01 principal (prd0101), 08 M&M, 15 Piura, 16 Chorrillos. Los rotulos son los
/////mismos del reporte de stock del grupo 25 (querys/reportes/informes.js); b, c, d y e son sus tablas, en ese orden
const NOMBRES_ALMACEN = ['PRINCIPAL','M&M','PIURA','CHORRILLOS'];
const ALMACENES = `join prd0101 b on b.codi=i.codi and b.estado=1
     left join prd0108 c on c.codi=b.codi
     left join prd0115 d on d.codi=b.codi
     left join prd0116 e on e.codi=b.codi
     left join tbl01mar m on m.codmar=b.codmar
     left join tbl01fam f on f.codfam=LEFT(b.codi,2)`;

/////encendida y dentro de sus fechas: la misma regla que usan los buscadores de la cotizacion
const VIGENTE = vigente('p');

function tipoDe(tipdsct){
    if(tipdsct === BENEFICIO.DESCUENTO) return 'DESCUENTO';
    if(tipdsct === BENEFICIO.REGALO) return 'REGALO';
    return null;
}

/////las marcas o familias distintas de una promocion, la que mas productos tiene primero. Casi
/////todas tienen una sola; si mezcla, se juntan con " / "
function unir(cuentas){
    return Object.keys(cuentas).sort((a,b)=>cuentas[b]-cuentas[a] || a.localeCompare(b)).join(' / ');
}

function cabecera(v, resumen){
    return {
        idprom: String(v[0]),
        nombre: texto(v[1]) || '',
        descripcion: texto(v[2]) || '',
        tipo: tipoDe(v[3]),
        venceEl: texto(v[4]),
        diasRestantes: v[5],
        /////la promocion es solo para algunas categorias de cliente (mst_promocion.listacatcli): no
        /////se dice cuales, solo que no es para todos
        soloAlgunosClientes: v[6] === 1,
        marca: unir(resumen.marcas),
        familia: unir(resumen.familias),
        productos: resumen.productos,
        disponibles: resumen.disponibles
    };
}

const CAMPOS = `p.idprom, p.nomprom, p.desprom, p.tipdsct, convert(char(10), p.fecfin, 23),
       datediff(day, cast(getdate() as date), cast(p.fecfin as date)),
       case when rtrim(isnull(p.listacatcli,''))<>'' then 1 else 0 end`;

async function hoy(conexion){
    const r = await ejecutar(conexion, `select convert(char(10), getdate(), 23)`, []);
    return texto(r.rows[0][0].value);
}

/////GET /promocion/vigentes
let promo_vigentes_lista = (resolve,reject,conexion,galleta)=>{
    soloLectura(resolve, reject, conexion, 'promociones vigentes', async ()=>{
        const cab = await ejecutar(conexion,
            `select ${CAMPOS} from mst_promocion p where ${VIGENTE} order by p.idprom`, []);
        /////un renglon por promocion, marca y familia, con sus productos y cuantos tienen stock
        const prod = await ejecutar(conexion,
            `select i.idprom, rtrim(m.Nommar), rtrim(f.nomfam), count(*),
                    sum(case when ${CON_STOCK} then 1 else 0 end)
             from (select distinct p.idprom, d.codi
                   from mst_promocion p join dtl_promocion_progra d on d.idprom=p.idprom
                   where ${VIGENTE}) i
             ${ALMACENES}
             group by i.idprom, m.Nommar, f.nomfam`, []);

        const resumenes = {};
        prod.rows.forEach(fila=>{
            const v = fila.map(c=>c.value);
            const r = resumenes[v[0]] = resumenes[v[0]] || {marcas:{}, familias:{}, productos:0, disponibles:0};
            const marca = texto(v[1]) || '', familia = texto(v[2]) || '';
            if(marca) r.marcas[marca] = (r.marcas[marca] || 0) + v[3];
            if(familia) r.familias[familia] = (r.familias[familia] || 0) + v[3];
            r.productos += v[3];
            r.disponibles += v[4];
        });

        const promociones = cab.rows
            .map(fila=>{
                const v = fila.map(c=>c.value);
                const resumen = resumenes[v[0]];
                return resumen ? cabecera(v, resumen) : null;
            })
            .filter(Boolean)
            /////las que vencen antes, primero: son las que no se pueden dejar para despues
            .sort((a,b)=>a.diasRestantes - b.diasRestantes || a.familia.localeCompare(b.familia) || a.marca.localeCompare(b.marca) || a.nombre.localeCompare(b.nombre));

        return {fecha: await hoy(conexion), total: promociones.length, promociones: promociones};
    });
}

/////GET /promocion/vigentes/:idprom
let promo_vigentes_detalle = (resolve,reject,conexion,galleta,idprom)=>{
    soloLectura(resolve, reject, conexion, 'promocion vigente', async ()=>{
        if(!/^[0-9]{1,9}$/.test(String(idprom))) return {rechazo:"promocion no vigente"};
        const parametros = [{nombre:'idprom', tipo:TYPES.Int, valor:parseInt(idprom,10)}];

        const cab = await ejecutar(conexion,
            `select ${CAMPOS} from mst_promocion p where p.idprom=@idprom and ${VIGENTE}`, parametros);
        if(cab.rows.length === 0) return {rechazo:"promocion no vigente"};

        const prod = await ejecutar(conexion,
            `select rtrim(b.descr), rtrim(b.Usr_001), rtrim(m.Nommar), rtrim(f.nomfam),
                    case when ${CON_STOCK} then 1 else 0 end,
                    case when ${hay('b')} then 1 else 0 end, case when ${hay('c')} then 1 else 0 end,
                    case when ${hay('d')} then 1 else 0 end, case when ${hay('e')} then 1 else 0 end
             from (select distinct codi from dtl_promocion_progra where idprom=@idprom) i
             ${ALMACENES}
             order by m.Nommar, b.descr`, parametros);

        const resumen = {marcas:{}, familias:{}, productos:0, disponibles:0};
        const productos = prod.rows.map(fila=>{
            const v = fila.map(c=>c.value);
            const marca = texto(v[2]) || '', familia = texto(v[3]) || '';
            if(marca) resumen.marcas[marca] = (resumen.marcas[marca] || 0) + 1;
            if(familia) resumen.familias[familia] = (resumen.familias[familia] || 0) + 1;
            resumen.productos++;
            if(v[4] === 1) resumen.disponibles++;
            return {descripcion: texto(v[0]) || '', partNumber: texto(v[1]) || '', marca: marca, familia: familia,
                    disponibilidad: v[4] === 1 ? DISPONIBLE : AGOTADO,
                    almacenes: NOMBRES_ALMACEN.filter((_,i)=>v[5+i] === 1)};
        });
        if(productos.length === 0) return {rechazo:"promocion no vigente"};

        return {fecha: await hoy(conexion), promocion: cabecera(cab.rows[0].map(c=>c.value), resumen), productos: productos};
    });
}

module.exports={promo_vigentes_lista, promo_vigentes_detalle, DISPONIBLE, AGOTADO}
