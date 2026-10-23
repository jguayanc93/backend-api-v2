require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')

let coti_cabecera = (resolve,reject,conexion,fecha,formato,info_cliente,atencion,totalisado,moneda)=>{

    let sq_sql="GrabaMstCotFac";
    let consulta= new Request(sq_sql,(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();
            ////////lo mandara aqui porqe aunque si exista no esta registrado en la intranet y debe registrarse
            resolve("cabecera creada");
        }
    })
    consulta.addParameter('fecha',TYPES.DateTime,fecha[1]);
    consulta.addParameter('cdocu',TYPES.Char,'31');
    consulta.addParameter('ndocu',TYPES.Char,formato);
    consulta.addParameter('codcli',TYPES.Char,info_cliente[0]);///SACAR DEL CLIENTE
    consulta.addParameter('nomcli',TYPES.Char,info_cliente[1]);///SACAR DEL CLIENTE
    consulta.addParameter('ruccli',TYPES.Char,info_cliente[2]);///SACAR DEL CLIENTE
    consulta.addParameter('atte',TYPES.Char,atencion);///SACAR DEL CLIENTE
    consulta.addParameter('nrefe',TYPES.Char,'');
    consulta.addParameter('requ',TYPES.Char,'');
    consulta.addParameter('mone',TYPES.Char,moneda);///SACAR DEL CLIENTE
    consulta.addParameter('tcam',TYPES.Float,fecha[0]);///CREAR LA CONSULTA

    /////ya redondeados con la regla del ERP (funciones/comunes/importes.js), en la moneda del documento
    consulta.addParameter('tota',TYPES.Float,totalisado[1].tota);
    consulta.addParameter('toti',TYPES.Float,totalisado[1].toti);
    consulta.addParameter('totn',TYPES.Float,totalisado[1].totn);
    consulta.addParameter('flag',TYPES.Char,'0');
    consulta.addParameter('codven',TYPES.VarChar,info_cliente[3]);///SACAR DEL CLIENTE
    
    consulta.addParameter('codcdv',TYPES.VarChar,info_cliente[4]);///SACAR DEL CLIENTE
    consulta.addParameter('cond',TYPES.Char,'');
    consulta.addParameter('fven',TYPES.DateTime,fecha[2]);///cuidado con este
    consulta.addParameter('dura',TYPES.Float,10);
    consulta.addParameter('cOperacion',TYPES.Char,'Nuevo');
    consulta.addParameter('obser',TYPES.Char,'');///identificador para diferenciar
    consulta.addParameter('estado',TYPES.Char,'0');
    consulta.addParameter('obsere',TYPES.Char,'Solicitud ya fue atendido por el bot.');
    consulta.addParameter('word',TYPES.Int,0);
    consulta.addParameter('obser2',TYPES.Char,'');
    consulta.addParameter('dirent',TYPES.VarChar,'');
    consulta.addParameter('codscc',TYPES.Char,'00');
    conexion.callProcedure(consulta);
}

module.exports={coti_cabecera}