const {config,Connection,Request,TYPES} = require('../../conexion/cadena')
const {error_corrector} = require('../error/err1')
const beneficio = require('./beneficio')

function bonificacion(destino,nprom,cotdetalle,promcabesa,promdetalle,tipopromo,tipometrica,arr,conexion,promo){
// function bonificacion(res,nprom,cotdetalle,promcabesa,promdetalle,tipopromo,tipometrica,items_validos,items_validos2,items_promos2){
    ////crear una busqueda correspondiente para ver cuales son sus respectivos items de descuentos
    ////porqe podria tener uno diferente a si mismo o podria tener 2 o mas items de regalo
    let contador=0;
    let objeto_promociones={};
    let tamaño;
    let items_validos;
    let items_validos2;
    let items_promos2;
    let contador_item;
    if(tipopromo[0]==1){
        items_validos2=arr[0];
        items_promos2=arr[1];
        /////el numero de item debe continuar al ULTIMO de la cotizacion, no contar solo
        /////los productos que califican: con 6 lineas y 1 producto en promo, el regalo
        /////salia con item 3 y chocaba con una linea existente.
        contador_item=Object.keys(cotdetalle).length;
    }
    else{
        items_validos=arr[0];
        items_validos2=arr[1];
        items_promos2=arr[2];
        contador_item=items_validos[6];
    }
    
    tipopromo[0]==1 ? tamaño=Object.keys(items_validos2) : tamaño=Object.keys(items_validos2);

    if(tipopromo[0]==1){
        bucle_bonificacion(destino,items_validos2,items_promos2,tamaño,contador,contador_item,objeto_promociones,conexion,promo);
    }
    else{
        intervalo_bonificacion_totalisada(destino,items_validos,items_validos2,items_promos2,tamaño,contador,contador_item,objeto_promociones,conexion,promo);
    }
    
}
let bucle_bonificacion=(destino,items_validos2,items_promos2,tamaño,contador,contador_item,objeto_promociones,conexion,promo)=>{
    if(tamaño.length<=contador){
        conexion.close();
        let solo_valores=Object.values(objeto_promociones);
        let valores_separados=[];
        let valores_finales={};
        for(let x in solo_valores){
            for(let y in solo_valores[x]){
                // console.log(solo_valores[x][y])
                valores_separados.push(solo_valores[x][y])
            }
            // valores_separados.push(solo_valores[x])
        }
        Object.assign(valores_finales,valores_separados);
        ///para el final
        destino.entregar(valores_finales)
    }
    else{
        let comodin_bon="GRATIS/PROM:(P#";
        let descripcion_acomodada="";
        let sp_sql="select b.codi,b.codf,b.marc,b.descr,b.pcus,b.msto,b.aigv,CAST(b.stoc as int) as stoc from dtl_promocion_bonitem a join prd0101 b on b.codf=a.boncodf where a.idprom=@nprom and a.codi=@codi order by a.positem";
        let consulta = new Request(sp_sql,(err,rowCount,rows)=>{
            if(err){
                console.error("[bonificacion] fallo la consulta de items bonificados",err);
                conexion.close();
                destino.fallar("error query");
                return;
            }
            else{
                if(rows.length==0){bucle_bonificacion(destino,items_validos2,items_promos2,tamaño,contador+1,contador_item,objeto_promociones,conexion,promo)}
                else{
                    let respuesta=[];
                    let respuesta2={};
                    let contador_interno=0;
                    rows.forEach(fila=>{
                        let tmp={};
                        fila.map(data=>{
                            if(contador_interno>=fila.length) contador_interno=0;
                            typeof data.value=='string' ? tmp[contador_interno]=data.value.trim() : tmp[contador_interno]=data.value;
                            contador_interno++;
                        })
                        respuesta.push(tmp);
                    });
                    Object.assign(respuesta2,respuesta);
                    objeto_promociones[tamaño[contador]]=[];
                    for(let item in respuesta){
                        // let comodin_completo=comodin_bon+items_promos2[tamaño][6].toString()+")"+respuesta[item][3];
                        let comodin_completo=comodin_bon+items_promos2[tamaño[contador]][6].toString()+")"+respuesta[item][3];
                        if(comodin_completo.length>80){
                            descripcion_acomodada=comodin_completo.substring(0,75);
                            descripcion_acomodada=descripcion_acomodada+"(BON)";
                        }
                        else{
                            if(comodin_completo.length>75){
                                descripcion_acomodada=comodin_completo.substring(0,75);
                                descripcion_acomodada=descripcion_acomodada+"(BON)";
                            }else{ descripcion_acomodada=comodin_completo+"(BON)"; }
                        }
                        /////TERMINAR LA CADENA COMPLETA DE LA BONIFICACION
                        // objeto_promociones[tamaño[contador]]=[items_validos2[tamaño[contador]][2],descripcion_acomodada];
                        // objeto_promociones[tamaño[contador]].push([items_validos2[tamaño[contador]][2],respuesta[item][0],descripcion_acomodada])
                        // objeto_promociones[tamaño[contador]].push([items_validos2[tamaño[contador]][0],items_validos2[tamaño[contador]][1],items_validos2[tamaño[contador]][2],items_validos2[tamaño[contador]][3],items_validos2[tamaño[contador]][4],items_validos2[tamaño[contador]][5],contador_item+1,items_validos2[tamaño[contador]][7],"D","D",respuesta[item][6],respuesta[item][0],respuesta[item][1],respuesta[item][2],"UND",descripcion_acomodada,items_validos2[tamaño[contador]][7],0,0,0,0,'01',respuesta[item][4],"S",1,"UND",""])
                        /////el regalo esta sujeto a stock: si la promo otorga mas unidades
                        /////de las que hay, solo se entrega lo disponible (indice 7 = stoc)
                        const stock_regalo=Number(respuesta[item][7]);
                        /////antes se usaba solo "veces" e ignoraba dsct (cuantos regalos por bloque).
                        /////Coincidia por casualidad porque todas las promos activas traen dsct=1.
                        const veces_b=Number(items_validos2[tamaño[contador]][7])||0;
                        const dsct_b=Number(items_promos2[tamaño[contador]][2])||1;
                        const otorgados=beneficio.calcular(promo,{veces:veces_b,umbral:Number(items_promos2[tamaño[contador]][1]),base:0,dsct:dsct_b});
                        const cantidad_regalo=Math.min(otorgados, isFinite(stock_regalo)?stock_regalo:0);
                        if(cantidad_regalo<=0){ continue; }
                        objeto_promociones[tamaño[contador]].push([items_validos2[tamaño[contador]][0],items_validos2[tamaño[contador]][1],items_validos2[tamaño[contador]][2],items_validos2[tamaño[contador]][3],items_validos2[tamaño[contador]][4],items_validos2[tamaño[contador]][5],contador_item+1,cantidad_regalo,"D","D",respuesta[item][6],respuesta[item][0],respuesta[item][1],respuesta[item][2],"UND",descripcion_acomodada,0,0,0,0,'01',respuesta[item][4],"S",1,"UND",""])
                        contador_item++;
                    }
                    bucle_bonificacion(destino,items_validos2,items_promos2,tamaño,contador+1,contador_item,objeto_promociones,conexion,promo)
                }
            }
        })
        // el error es porqe en el objeto de items_promos2 no existe tal index por eso te bota el error
        consulta.addParameter('nprom',TYPES.VarChar,items_promos2[tamaño[contador]][6].toString());
        consulta.addParameter('codi',TYPES.VarChar,items_promos2[tamaño[contador]][0]);
        conexion.execSql(consulta);
    }
}
let intervalo_bonificacion_totalisada=(destino,items_validos,items_validos2,items_promos2,tamaño,contador,contador_item,objeto_promociones,conexion,promo)=>{
// let intervalo_bonificacion_totalisada=(destino,items_validos2,items_promos2,tamaño,contador,contador_item,objeto_promociones)=>{
    let nuevo_items_promos2={};
    for(let item in items_promos2) nuevo_items_promos2[items_promos2[item][0]]=items_promos2[item];
    // bucle_bonificacion2(destino,items_validos2,nuevo_items_promos2,tamaño,contador,contador_item,objeto_promociones)
    bucle_bonificacion2(destino,items_validos,items_validos2,items_promos2,tamaño,contador,contador_item,objeto_promociones,conexion,promo)
}
let bucle_bonificacion2=(destino,items_validos,items_validos2,items_promos2,tamaño,contador,contador_item,objeto_promociones,conexion,promo)=>{
// let bucle_bonificacion2=(destino,items_validos2,items_promos2,tamaño,contador,contador_item,objeto_promociones)=>{
    if(tamaño.length<=contador){
        conexion.close();
        let solo_valores=Object.values(objeto_promociones);
        //////no te olvides derivar a una funcion q discrime a las cantidades en 0
        
        destino.entregar(objeto_promociones)
    }
    else{
        let comodin_bon="GRATIS/PROM:(P#";
        let descripcion_acomodada="";
        let sp_sql="select b.codi,b.codf,b.marc,b.descr,b.pcus,b.msto,b.aigv,CAST(b.stoc as int) as stoc from dtl_promocion_bonitem a join prd0101 b on b.codf=a.boncodf where a.idprom=@nprom and a.codi=@codi order by a.positem";
        let consulta = new Request(sp_sql,(err,rowCount,rows)=>{
            if(err){
                console.error("[bonificacion] fallo la consulta de items bonificados",err);
                conexion.close();
                destino.fallar("error query");
                return;
            }
            else{
                if(rows.length==0){bucle_bonificacion2(destino,items_validos,items_validos2,items_promos2,tamaño,contador+1,contador_item+1,objeto_promociones,conexion,promo)}
                else{
                    let respuesta=[];
                    let respuesta2={};
                    let contador_interno=0;
                    rows.forEach(fila=>{
                        let tmp={};
                        fila.map(data=>{
                            if(contador_interno>=fila.length) contador_interno=0;
                            typeof data.value=='string' ? tmp[contador_interno]=data.value.trim() : tmp[contador_interno]=data.value;
                            contador_interno++;
                        })
                        respuesta.push(tmp);
                    });
                    Object.assign(respuesta2,respuesta);
                    for(let item in respuesta){
                        // let comodin_completo=comodin_bon+items_promos2[tamaño][6].toString()+")"+respuesta[item][3];
                        // let comodin_completo=comodin_bon+items_promos2[tamaño[contador]][6].toString()+")"+respuesta[item][3];
                        let comodin_completo=comodin_bon+items_validos2[tamaño[contador]][6].toString()+")"+respuesta[item][3];
                        if(comodin_completo.length>80){
                            descripcion_acomodada=comodin_completo.substring(0,75);
                            descripcion_acomodada=descripcion_acomodada+"(BON)";
                        }
                        else{
                            if(comodin_completo.length>75){
                                descripcion_acomodada=comodin_completo.substring(0,75);
                                descripcion_acomodada=descripcion_acomodada+"(BON)";
                            }else{ descripcion_acomodada=comodin_completo+"(BON)"; }
                        }
                        /////TERMINAR LA CADENA COMPLETA DE LA BONIFICACION
                        // objeto_promociones[tamaño[contador]]=[items_validos2[tamaño[contador]][2],descripcion_acomodada];
                        // objeto_promociones[tamaño[contador]]=[items_validos2[2],descripcion_acomodada];
                        
                        if(Object.keys(objeto_promociones).includes(respuesta[item][0])){
                            ///si existe el codi debo de aumentar la cantidad de unidades a regalar de este item
                            // objeto_promociones[respuesta[item][0]][6]+=1;
                            // objeto_promociones[respuesta[item][0]][6]=contador_item;
                        }
                        else{
                            const stock_regalo2=Number(respuesta[item][7]);
                            /////misma regla que /detalle: veces x dsct, topado por stock.
                            /////items_promos2 en esta rama es un arreglo de renglones de la promo,
                            /////y el umbral/dsct son unicos por promocion (verificado en BD).
                            const veces_b2=Number(items_validos[7])||0;
                            const reng_b2=Array.isArray(items_promos2)?items_promos2[0]:items_promos2[Object.keys(items_promos2)[0]];
                            const dsct_b2=reng_b2?Number(reng_b2[2])||1:1;
                            const umbral_b2=reng_b2?Number(reng_b2[1])||0:0;
                            const otorgados2=beneficio.calcular(promo,{veces:veces_b2,umbral:umbral_b2,base:0,dsct:dsct_b2});
                            const cantidad_regalo2=Math.min(otorgados2, isFinite(stock_regalo2)?stock_regalo2:0);
                            if(cantidad_regalo2<=0){}
                            else{
                                objeto_promociones[respuesta[item][0]]=[items_validos[0],items_validos[1],items_validos[2],items_validos[3],items_validos[4],items_validos[5],contador_item,cantidad_regalo2,"D","D",respuesta[item][6],respuesta[item][0],respuesta[item][1],respuesta[item][2],"UND",descripcion_acomodada,0,0,0,0,'01',respuesta[item][4],"S",1,"UND",""];
                            }
                            // objeto_promociones[respuesta[item][0]]=[items_validos2[0],items_validos2[1],items_validos2[2],items_validos2[3],items_validos2[4],items_validos2[5],contador_item,items_validos2[7],"D","D",respuesta[item][6],respuesta[item][0],respuesta[item][1],respuesta[item][2],"UND",descripcion_acomodada,0,0,0,0,'01',respuesta[item][4],"S",1,"UND",""];

                            // objeto_promociones[respuesta[item][0]]=[items_validos[0],items_validos[1],items_validos[2],items_validos[3],items_validos[4],items_validos[5],contador_item,items_validos[7],"D","D",respuesta[item][6],respuesta[item][0],respuesta[item][1],respuesta[item][2],"UND",descripcion_acomodada,0,0,0,0,'01',respuesta[item][4],"S",1,"UND",""];
                        }
                        contador_item++;
                        // objeto_promociones[tamaño[contador]].push([items_validos2[tamaño[contador]][2],respuesta[item][0],descripcion_acomodada])
                        // objeto_promociones[tamaño[contador]].push([items_validos2[tamaño[contador]][0],items_validos2[tamaño[contador]][1],items_validos2[tamaño[contador]][2],items_validos2[tamaño[contador]][3],items_validos2[tamaño[contador]][4],items_validos2[tamaño[contador]][5],contador_item+1,items_validos2[tamaño[contador]][7],"D","D",respuesta[item][6],respuesta[item][0],respuesta[item][1],respuesta[item][2],"UND",descripcion_acomodada,items_validos2[tamaño[contador]][7],0,0,0,0,'01',respuesta[item][4],"S",1,"UND",""])
                        // objeto_promociones[tamaño[contador]].push([items_validos2[tamaño[contador]][0],items_validos2[tamaño[contador]][1],items_validos2[tamaño[contador]][2],items_validos2[tamaño[contador]][3],items_validos2[tamaño[contador]][4],items_validos2[tamaño[contador]][5],contador_item+1,items_validos2[tamaño[contador]][7],"D","D",respuesta[item][6],respuesta[item][0],respuesta[item][1],respuesta[item][2],"UND",descripcion_acomodada,0,0,0,0,'01',respuesta[item][4],"S",1,"UND",""])
                        
                    }
                    bucle_bonificacion2(destino,items_validos,items_validos2,items_promos2,tamaño,contador+1,contador_item+1,objeto_promociones,conexion,promo)
                }
            }
        })
        // el error es porqe en el objeto de items_promos2 no existe tal index por eso te bota el error
        // consulta.addParameter('nprom',TYPES.VarChar,items_promos2[tamaño[contador]][6].toString());
        consulta.addParameter('nprom',TYPES.VarChar,items_validos2[tamaño[contador]][6].toString());
        // consulta.addParameter('codi',TYPES.VarChar,items_promos2[tamaño[contador]][0]);
        consulta.addParameter('codi',TYPES.VarChar,items_validos2[tamaño[contador]][0]);
        conexion.execSql(consulta);
    }
}

module.exports=bonificacion;