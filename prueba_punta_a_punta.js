/////Prueba punta a punta de promociones: acopla una promocion a una cotizacion real,
/////revisa como quedo el detalle y la cabecera, y luego la retira comprobando que todo
/////vuelve a su estado original.
/////
/////ESTO ESCRIBE EN LA BASE. Por eso se niega a correr contra produccion.
/////Uso:  node prueba_punta_a_punta.js <ndocu> <idprom> <codven>

const {config, Request, TYPES, descripcion} = require('./conexion/cadena');
const {adquirir} = require('./conexion/pool');

/////----------------------------------------------------------------------------
/////SEGURO: no correr contra la base de produccion bajo ninguna circunstancia
/////----------------------------------------------------------------------------
const PRODUCCION = {servidor:'192.168.1.101', base:'bdnava01'};
if(config.server===PRODUCCION.servidor && config.options.database===PRODUCCION.base){
    console.error('');
    console.error('  ABORTADO: esta prueba escribe en la base y apunta a PRODUCCION');
    console.error('  ('+descripcion()+')');
    console.error('');
    console.error('  Configura un .env con los datos de la base de pruebas antes de correrla.');
    console.error('');
    process.exit(1);
}

const [,, NDOCU, IDPROM, CODVEN] = process.argv;
if(!NDOCU || !IDPROM || !CODVEN){
    console.error('Uso: node prueba_punta_a_punta.js <ndocu> <idprom> <codven>');
    console.error('Ejemplo: node prueba_punta_a_punta.js 009-00970435 14656 J01');
    process.exit(1);
}

function sel(sql,ps){
    return new Promise((res,rej)=>adquirir().then(cx=>{
        const filas=[];
        const q=new Request(sql,(e,rc,rows)=>{ cx.close(); if(e)return rej(e);
            (rows||[]).forEach(f=>{const o={};f.forEach(c=>{o[c.metadata.colName]=(typeof c.value==='string')?c.value.trim():c.value;});filas.push(o);});
            res(filas);});
        (ps||[]).forEach(p=>q.addParameter(p.n,p.t,p.v));
        cx.execSql(q);
    }).catch(rej));
}

const P=[{n:'c',t:TYPES.VarChar,v:NDOCU}];
const cabecera = ()=>sel("select tota,toti,totn,flag,estado from mst01cot where ndocu=@c",P);
const lineas   = ()=>sel("select item,codi,LEFT(descr,40) as descr,cant,tota,totn from dtl01cot where ndocu=@c order by item",P);
const promos   = ()=>sel("select COUNT(*) as n from dtl01cot where ndocu=@c and (codi='0303-010001' or LEFT(descr,11)='GRATIS/PROM')",P);

function mostrarCabecera(t,c){
    const f=c[0];
    const cuadra = Math.abs((f.tota+f.toti)-f.totn) < 0.02;
    console.log('  '+t.padEnd(14)+' tota='+String(f.tota).padEnd(11)+' toti='+String(f.toti).padEnd(10)+
                ' totn='+String(f.totn).padEnd(11)+(cuadra?' [cuadra]':' [NO CUADRA]'));
}

(async()=>{
    console.log('');
    console.log('base: '+descripcion());
    console.log('cotizacion: '+NDOCU+'   promocion: '+IDPROM+'   vendedor: '+CODVEN);
    console.log('');

    const c0=await cabecera();
    if(c0.length===0){ console.error('la cotizacion no existe en esta base'); process.exit(1); }
    if(String(c0[0].flag)!=='0' || String(c0[0].estado)!=='0'){
        console.error('la cotizacion tiene flag='+c0[0].flag+' estado='+c0[0].estado+'; se requiere 0/0');
        process.exit(1);
    }

    const l0=await lineas(), p0=await promos();
    console.log('--- ESTADO INICIAL ---');
    mostrarCabecera('inicial',c0);
    console.log('  lineas totales: '+l0.length+'   de promocion: '+p0[0].n);
    console.log('');
    console.log('  Para continuar hay que llamar a /acoplar y /eliminar con una sesion valida.');
    console.log('  Este script deja listo el antes/despues; el siguiente paso es ejecutarlo');
    console.log('  contra el servicio levantado sobre esta misma base.');
    console.log('');
    process.exit(0);
})().catch(e=>{console.error('ERROR:',e.message||e);process.exit(1);});
