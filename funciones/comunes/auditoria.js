const {Request,TYPES} = require('../../conexion/cadena');
const {conn} = require('../../conexion/cnn');
const {leerGalleta} = require('./auth');

/////Registro de lo que hace cada usuario, y desde donde.
/////
/////Dos reglas que no se rompen:
/////
/////  1. NUNCA tumba la peticion. Si la tabla no existe, si la base no responde o si el
/////     User-Agent viene raro, se registra el fallo en el log del servidor y la operacion
/////     sigue. Auditar es importante; no tanto como vender.
/////
/////  2. Escribe DESPUES de responder. El vendedor no espera a que se guarde su rastro.
/////
/////Solo se auditan las acciones que escriben. Las consultas no: un vendedor que mira
/////listas todo el dia generaria miles de filas que no dicen nada.

const INSERTAR_ACCION =
    "insert into tbl_api_auditoria(codusu,codven,nombre,grupo,modulo,accion,documento,"+
    "resultado,http,dispositivo,sistema,navegador,ip,detalle) values("+
    "@codusu,@codven,@nombre,@grupo,@modulo,@accion,@documento,@resultado,@http,"+
    "@dispositivo,@sistema,@navegador,@ip,@detalle)";

const INSERTAR_SESION =
    "insert into tbl_api_sesiones(codusu,codven,nombre,grupo,diferenciador,evento,motivo,"+
    "dispositivo,sistema,navegador,ip,agente) values("+
    "@codusu,@codven,@nombre,@grupo,@diferenciador,@evento,@motivo,"+
    "@dispositivo,@sistema,@navegador,@ip,@agente)";

/////El User-Agent no es fiable -se puede falsear- pero para saber si la gente usa el
/////movil o el escritorio sirve de sobra, que es para lo que se pide.
function desdeDonde(req){
    const agente = String((req && req.headers && req.headers['user-agent']) || '');

    let dispositivo = 'desktop';
    if(/\bTablet\b|\biPad\b/i.test(agente)) dispositivo = 'tablet';
    else if(/\bMobi|\bAndroid\b.*\bMobile\b|\biPhone\b|\biPod\b/i.test(agente)) dispositivo = 'movil';
    else if(/\bAndroid\b/i.test(agente)) dispositivo = 'tablet';
    if(agente === '') dispositivo = null;

    let sistema = null;
    if(/\bAndroid\b/i.test(agente)) sistema = 'Android';
    else if(/\biPhone\b|\biPad\b|\biPod\b/i.test(agente)) sistema = 'iOS';
    else if(/\bWindows\b/i.test(agente)) sistema = 'Windows';
    else if(/\bMac OS X\b|\bMacintosh\b/i.test(agente)) sistema = 'macOS';
    else if(/\bLinux\b/i.test(agente)) sistema = 'Linux';

    /////el orden importa: Edge y Opera tambien dicen Chrome, y Chrome tambien dice Safari
    let navegador = null;
    if(/\bEdgA?\//i.test(agente)) navegador = 'Edge';
    else if(/\bOPR\/|\bOpera\b/i.test(agente)) navegador = 'Opera';
    else if(/\bChrome\//i.test(agente)) navegador = 'Chrome';
    else if(/\bFirefox\//i.test(agente)) navegador = 'Firefox';
    else if(/\bSafari\//i.test(agente)) navegador = 'Safari';

    const ip = (req && (
        (req.headers && (req.headers['x-forwarded-for']||'').split(',')[0].trim()) ||
        (req.socket && req.socket.remoteAddress) || null)) || null;

    return {dispositivo, sistema, navegador, ip: ip ? String(ip).slice(0,45) : null, agente};
}

const recortar = (v,n)=> v==null ? null : String(v).trim().slice(0,n);

function escribir(sql, parametros){
    /////conexion propia y desechable: no se cuelga de la que use la operacion, que puede
    /////estar dentro de una transaccion
    conn(
        (conexion)=>{
            const consulta = new Request(sql,(err)=>{
                if(err) console.error("[auditoria] no se pudo registrar:",err.message);
                conexion.close();
            });
            parametros.forEach(p=>consulta.addParameter(p.nombre,p.tipo,p.valor));
            conexion.execSql(consulta);
        },
        (err)=>console.error("[auditoria] sin conexion:",err && err.message)
    );
}

/////Middleware. Se monta en las rutas que escriben:
/////    router.post('/pegar', auditar('cotizacion','crear'), new_creacion)
/////
/////Lee el documento de la respuesta si viene, y si no del cuerpo. No hace falta que el
/////handler sepa que existe.
function auditar(modulo, accion){
    return function(req,res,next){
        const original = res.json.bind(res);

        res.json = function(cuerpo){
            try{ registrar(req,res,modulo,accion,cuerpo); }
            catch(e){ console.error("[auditoria]",e && e.message); }
            return original(cuerpo);
        };

        next();
    };
}

function registrar(req,res,modulo,accion,cuerpo){
    const u = req.usuario || leerGalleta(req) || {};
    const d = desdeDonde(req);
    const c = cuerpo || {};

    const documento = c.documento || c.ndocu ||
                      (req.body && (req.body.ndocu || req.body.npedi || req.body.doc || req.body.ncoti)) || null;

    escribir(INSERTAR_ACCION,[
        {nombre:'codusu',     tipo:TYPES.VarChar, valor:recortar(u.identificador,12)},
        {nombre:'codven',     tipo:TYPES.VarChar, valor:recortar(u.codigo,12)},
        {nombre:'nombre',     tipo:TYPES.VarChar, valor:recortar(u.nombre,60)},
        {nombre:'grupo',      tipo:TYPES.VarChar, valor:recortar(u.id_grupo,10)},
        {nombre:'modulo',     tipo:TYPES.VarChar, valor:modulo},
        {nombre:'accion',     tipo:TYPES.VarChar, valor:accion},
        {nombre:'documento',  tipo:TYPES.VarChar, valor:recortar(documento,16)},
        {nombre:'resultado',  tipo:TYPES.VarChar, valor:recortar(c.status || 'ok',30)},
        {nombre:'http',       tipo:TYPES.Int,     valor:Number(res.statusCode) || null},
        {nombre:'dispositivo',tipo:TYPES.VarChar, valor:d.dispositivo},
        {nombre:'sistema',    tipo:TYPES.VarChar, valor:d.sistema},
        {nombre:'navegador',  tipo:TYPES.VarChar, valor:d.navegador},
        {nombre:'ip',         tipo:TYPES.VarChar, valor:d.ip},
        {nombre:'detalle',    tipo:TYPES.VarChar, valor:recortar(c.msg,400)}
    ]);
}

/////Para el login, que no encaja en el middleware: no hay documento y si hay
/////diferenciador. Se llama a mano desde los handlers de sesion.
function registrarSesion(req, evento, datos){
    const d = desdeDonde(req);
    const u = (datos && datos.usuario) || {};

    escribir(INSERTAR_SESION,[
        {nombre:'codusu',       tipo:TYPES.VarChar, valor:recortar(u.identificador,12)},
        {nombre:'codven',       tipo:TYPES.VarChar, valor:recortar(u.codigo,12)},
        {nombre:'nombre',       tipo:TYPES.VarChar, valor:recortar(u.nombre,60)},
        {nombre:'grupo',        tipo:TYPES.VarChar, valor:recortar(u.id_grupo,10)},
        {nombre:'diferenciador',tipo:TYPES.VarChar, valor:recortar(datos && datos.diferenciador,20)},
        {nombre:'evento',       tipo:TYPES.VarChar, valor:recortar(evento,12)},
        {nombre:'motivo',       tipo:TYPES.VarChar, valor:recortar(datos && datos.motivo,40)},
        {nombre:'dispositivo',  tipo:TYPES.VarChar, valor:d.dispositivo},
        {nombre:'sistema',      tipo:TYPES.VarChar, valor:d.sistema},
        {nombre:'navegador',    tipo:TYPES.VarChar, valor:d.navegador},
        {nombre:'ip',           tipo:TYPES.VarChar, valor:d.ip},
        {nombre:'agente',       tipo:TYPES.VarChar, valor:recortar(d.agente,250)}
    ]);
}

module.exports={auditar, registrarSesion, desdeDonde};
