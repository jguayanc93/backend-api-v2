const {Request,TYPES} = require('../../conexion/cadena');

/////Cambia UN campo de una factura, en una conexion y dentro de una transaccion.
/////
/////Antes esta consulta recibia el SQL ya armado y lo ejecutaba sin mas: no miraba de
/////quien era la factura ni en que estado estaba, y respondia "actualisado" aunque no
/////hubiera tocado ninguna fila. Con la clave 5 eso permitia reasignar codven_usu, o sea
/////quitarle la factura a su dueño, sabiendo solo el numero.
/////
/////Las siete rutas de lectura ya exigian cdocu in('01','03'), flag<>'*', ndge='' y
/////codven_usu del que pregunta. Aqui se aplican los mismos filtros: no tenia sentido que
/////leer estuviera protegido y escribir no.

/////clave numerica -> columna y nombre del permiso. La clave la manda el frontend y es la
/////que ya usaba; el nombre es el de la matriz de permisos.
const CAMPOS = {
    1:{columna:'TipEnt',     permiso:'despacho'},
    2:{columna:'codtra2',    permiso:'transporte'},
    3:{columna:'Consig',     permiso:'atencion'},
    4:{columna:'dirent',     permiso:'direccion'},
    5:{columna:'codven_usu', permiso:'vendedor'},
    6:{columna:'observ',     permiso:'observacion'},
    7:{columna:'orde',       permiso:'orden'}
};

const CONDICION =
    "ndocu=@doc AND cdocu in ('01','03') AND flag<>'*' AND ndge='' AND codven_usu=@codven";

function ejecutar(conexion, sql, parametros){
    return new Promise((resolve,reject)=>{
        const consulta = new Request(sql,(err,rowCount,rows)=>{
            if(err) return reject(err);
            resolve(rows||[]);
        });
        (parametros||[]).forEach(p=>consulta.addParameter(p.nombre,p.tipo,p.valor));
        conexion.execSql(consulta);
    });
}
/////el rowCount de tedious cuenta result sets, no filas afectadas
function ejecutarContando(conexion, sql, parametros){
    return ejecutar(conexion, sql+"; select @@ROWCOUNT as afectadas;", parametros)
        .then(r => (r.length ? Number(r[0][0].value) : 0));
}
function iniciar(conexion){
    return new Promise((res,rej)=>conexion.beginTransaction(e=>e?rej(e):res(),'campo_factura'));
}
function confirmar(conexion){
    return new Promise((res,rej)=>conexion.commitTransaction(e=>e?rej(e):res()));
}
function revertir(conexion){
    return new Promise((res)=>conexion.rollbackTransaction(()=>res()));
}

let factura_campo_update = async (resolve,reject,conexion,galleta,clave,valor)=>{
    const codven = galleta ? galleta.codigo : null;
    const campo = CAMPOS[clave];

    if(!codven){ conexion.close(); return reject("falsa galleta"); }
    if(!campo){  conexion.close(); return reject("campo desconocido"); }

    const documento = String((valor && valor.doc) || '').trim();
    const nuevo = valor ? valor.nuevo : null;
    if(!documento){ conexion.close(); return reject("factura desconocida"); }

    const parametros = ()=>[
        {nombre:'doc',tipo:TYPES.VarChar,valor:documento},
        {nombre:'codven',tipo:TYPES.VarChar,valor:codven}
    ];

    let abierta=false;
    try{
        await iniciar(conexion);
        abierta=true;

        /////1) existir, ser suya y estar en estado editable
        const suya = await ejecutar(conexion,
            "select ndocu from mst01fac with (updlock) where "+CONDICION, parametros());

        if(suya.length===0){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("factura desconocida");
        }

        /////2) el cambio. La columna sale de la tabla de arriba, nunca del cuerpo.
        const afectadas = await ejecutarContando(conexion,
            "update mst01fac set "+campo.columna+"=@nuevo where "+CONDICION,
            parametros().concat([{nombre:'nuevo',tipo:TYPES.VarChar,valor:nuevo}]));

        if(afectadas === 0){
            await revertir(conexion); abierta=false;
            conexion.close();
            return reject("factura desconocida");
        }

        /////3) se devuelve lo que quedo guardado, no lo que se mando: si la base
        /////   normaliza algo, que se vea. Se lee sin el filtro de vendedor porque la
        /////   clave 5 cambia justo ese campo y la factura ya no seria suya.
        const guardado = await ejecutar(conexion,
            "select "+campo.columna+" from mst01fac where ndocu=@doc",
            [{nombre:'doc',tipo:TYPES.VarChar,valor:documento}]);

        const quedo = guardado.length ? guardado[0][0].value : null;

        await confirmar(conexion); abierta=false;
        conexion.close();
        resolve({
            documento: documento,
            campo: campo.permiso,
            valor: typeof quedo==='string' ? quedo.trim() : quedo
        });
    }
    catch(err){
        console.error("[factura_campo_update]",err);
        if(abierta) await revertir(conexion);
        conexion.close();
        reject("error query");
    }
}

module.exports={factura_campo_update, CAMPOS}
