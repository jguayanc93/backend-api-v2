require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')

/////¿Ya registro su cuota de este mes?
/////
/////Antes esta funcion RECHAZABA cuando la cuota existia, y la ruta /cuota/simple -a la
/////que redirige /cuota/revisar- convertia ese rechazo en un 403
/////"vendedor tiene un registro de cuota de este mes".
/////
/////Que la cuota ya este registrada no es un error: es la mitad de la respuesta a la
/////pregunta que hace la pantalla. Devolver 403 hacia que, en cuanto el vendedor
/////registraba su cuota, la pantalla leyera un fallo donde habia un dato.
/////
/////Ahora las dos salidas son exito y la pantalla decide con un booleano.

const CONSULTA =
    "select monto, diferenciador from tbl_api_vendedores_meta"+
    " where anno=YEAR(GETDATE()) and mes=MONTH(GETDATE()) and codven=@codusu";

let cuota_existe = (resolve,reject,conexion,galleta)=>{

    const consulta = new Request(CONSULTA,(err,rowCount,rows)=>{
        conexion.close();
        if(err){
            console.error("[cuota_existe]",err);
            return reject("error query");
        }

        if(!rows || rows.length === 0){
            return resolve({
                /////el texto de siempre, por si alguna pantalla todavia lo lee
                estado:"registro permitido",
                puedeRegistrar:true,
                yaRegistrada:false,
                monto:null
            });
        }

        const fila = rows[0];
        resolve({
            estado:"cuota existe",
            puedeRegistrar:false,
            yaRegistrada:true,
            monto: fila[0] != null ? Number(fila[0].value) : null,
            diferenciador: fila[1] && typeof fila[1].value === 'string' ? fila[1].value.trim() : (fila[1]?fila[1].value:null)
        });
    })
    consulta.addParameter('codusu',TYPES.VarChar,galleta.identificador);
    conexion.execSql(consulta);
}

module.exports={cuota_existe}
