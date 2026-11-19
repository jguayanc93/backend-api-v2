require('dotenv').config();
const {Request,TYPES} = require('../../conexion/cadena')

/////Autocompletado de productos al crear una cotizacion: hasta 5 sugerencias por
/////descripcion (tipbusq 1) o por Usr_001 (tipbusq 2).
/////
/////El stock de cada almacen es el DISPONIBLE: stoc - (svta + pedi), lo ya separado y
/////lo comprometido en pedidos no se puede volver a vender. Es la misma cuenta que usan
/////ajuste, promociones vigentes y los reportes. Hasta el 18/11/2026 aqui salia stoc a
/////secas, y el vendedor veia unidades que ya estaban tomadas.
/////
/////Las columnas salen en el mismo orden de siempre porque la pantalla las lee por
/////posicion: 0 codi, 1 descr, 2 principal, 3 m&m, 4 dscto_maxven, 5 vvus, 6 piura.

/////prd0101 principal, prd0108 M&M, prd0115 Piura
const disponible = (a)=>`(CAST(ISNULL(${a}.stoc,0) as int)-(CAST(ISNULL(${a}.svta,0) as int)+CAST(ISNULL(${a}.pedi,0) as int)))`;

const CAMPO_BUSQUEDA = { '1':'a.descr', '2':'a.Usr_001' };

function armarConsulta(campo){
    return "select top 5 a.codi,a.descr,"+
        disponible('a')+" as 'principal',"+
        disponible('b')+" as 'm&m',"+
        "c.dscto_maxven,a.vvus,"+
        disponible('d')+" as 'piura'"+
        " from prd0101 a"+
        " left join prd0108 b on (b.codi=a.codi)"+
        " left join prd0115 d on (d.codi=a.codi)"+
        " inner join dtl_dscto_marca_tc c on (c.codmar=a.codmar)"+
        " where a.estado=1 AND CAST(a.vvus as int)>1 AND c.codtcl=@abecedario and "+campo+" like @pista"+
        " order by "+disponible('a')+" desc";
}

let producto_buscar = (resolve,reject,conexion,req,next)=>{

    let tipbusq=String(req.body.tipbusq);
    let caracter=`%${req.body.sugerencia}%`;
    let letra = req.body.letra;

    const campo = CAMPO_BUSQUEDA[tipbusq];
    if(!campo){
        conexion.close();
        return reject("producto no similitudes");
    }

    let consulta= new Request(armarConsulta(campo),(err,rowCount,rows)=>{
        if(err){
            conexion.close();
            reject("error query");
        }
        else{
            conexion.close();

            if(rows.length==0){
                reject("producto no similitudes");
            }
            else{
                let respuesta=[];
                let respuesta2={};
                let contador=0;
                rows.forEach(fila=>{
                    let tmp={};
                    fila.map(data=>{
                        if(contador>=fila.length) contador=0;
                        typeof data.value=='string' ? tmp[contador]=data.value.trim() : tmp[contador]=data.value;
                        contador++;
                    })
                    respuesta.push(tmp);
                });
                Object.assign(respuesta2,respuesta);
                resolve(respuesta2);
            }
        }
    })
    consulta.addParameter('abecedario',TYPES.VarChar,letra);
    consulta.addParameter('pista',TYPES.VarChar,caracter);
    conexion.execSql(consulta);
}

module.exports={producto_buscar}
