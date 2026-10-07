const {PROMDET} = require('../comunes/constantes');
const beneficio = require('./beneficio');


let descuento_correspondiente=(codigos,cotdetalle,tipopromo,promcabesa,promdetalle)=>{
    //////FALTA UN FOR PARA SABER EN Q NUMERO DE ITEM SE ENCUENTRA
    let numero_item=1;
    numero_item=Object.keys(cotdetalle).length;
    let cantidad_correspondiente_obtenida;

    if(tipopromo["metrica"]==1){
        cantidad_correspondiente_obtenida=vx_valorizado(codigos,cotdetalle,tipopromo,promcabesa,promdetalle)
    }else{
        cantidad_correspondiente_obtenida=vx_unidad(codigos,cotdetalle,tipopromo,promcabesa,promdetalle)
    }
    // tipometrica==1 ? cantidad_correspondiente_obtenida=m_valorizado() : cantidad_correspondiente_obtenida=m_unidades(nprom,cotdetalle,promcabesa,promdetalle,tipopromo,tipometrica,numero_item);
    return cantidad_correspondiente_obtenida;
}
/////COMBINACION 1 y 3: venta POR ITEM con metrica VALORIZADO.
/////Estaba sin implementar (funcion vacia), asi que devolvia undefined.
/////Regla: cuando el valorizado de un producto alcanza el monto de la promo se le
/////otorga el beneficio, y si lo alcanza varias veces se le otorga varias veces.
function vx_valorizado(codigos,cotdetalle,tipopromo,promcabesa,promdetalle){
    let objeto_regresar={};
    let items_correspondientes={};
    let participantes=0;        ////cuantos productos del carrito estan en la promo
    let faltante_minimo=null;   ////lo que le falta al que esta mas cerca de alcanzarla

    /////se queda con los productos del carrito que estan en la promo y alcanzan el monto
    for(let y in promdetalle){
        const codigo=promdetalle[y][PROMDET.CODI];
        if(!codigos.includes(codigo)) continue;

        const monto_minimo=Number(promdetalle[y][PROMDET.MONTO]);   ////umbral EN DINERO
        const dsct=Number(promdetalle[y][PROMDET.DSCT]);
        const valorizado=Number(cotdetalle[codigo]["preciosinIGV"]);
        const nombre_item=cotdetalle[codigo]["descripcion"];

        /////monto 0 significaria division por cero: se descarta
        participantes++;
        if(monto_minimo>0 && valorizado>=monto_minimo){
            items_correspondientes[codigo]=[valorizado,monto_minimo,dsct,nombre_item];
        }
        else if(monto_minimo>0){
            const falta=monto_minimo-valorizado;
            if(faltante_minimo===null || falta<faltante_minimo) faltante_minimo=falta;
        }
    }

    let contador_momentane=0;
    for(let x in items_correspondientes){
        const [valorizado,monto_minimo,dsct,nombre_item]=items_correspondientes[x];

        /////cuantas veces alcanza el monto (escalonado)
        const veces=Math.floor(valorizado/monto_minimo);

        /////base del porcentual: solo la parte que alcanzo el umbral, no el total de la linea
        const base_porcentual=veces*monto_minimo;
        const corresponde=beneficio.calcular(tipopromo,{veces:veces,umbral:monto_minimo,base:base_porcentual,dsct:dsct});

        objeto_regresar[contador_momentane]={};
        objeto_regresar[contador_momentane]["codigo"]=tipopromo["idprom"];
        objeto_regresar[contador_momentane]["descripcion"]=tipopromo["nombre"];
        objeto_regresar[contador_momentane]["cantidad"]=veces;
        objeto_regresar[contador_momentane]["montoDescuento"]=corresponde;
        objeto_regresar[contador_momentane]["monedaDescuento"]="D";
        objeto_regresar[contador_momentane]["itemdescr"]=nombre_item;
        tipopromo["descuento"]==1 ? objeto_regresar[contador_momentane]["tipo"]=["descuento"] : objeto_regresar[contador_momentane]["tipo"]=["regalo"];
        contador_momentane++;
    }

    if(Object.keys(objeto_regresar).length>0){
        tipopromo["descuento"]==1 ? objeto_regresar["tipo"]=["descuento"] : objeto_regresar["tipo"]=["regalo"];
        objeto_regresar["descripcion"]=tipopromo["nombre"];
        return objeto_regresar;
    }
    return no_aplica(participantes,faltante_minimo,"monto");
}
function vx_unidad(codigos,cotdetalle,tipopromo,promcabesa,promdetalle){
    let objeto_regresar={};
    let items_correspondientes={};
    let participantes=0;        ////cuantos productos del carrito estan en la promo
    let faltante_minimo=null;   ////cuantas unidades le faltan al que esta mas cerca
    // let check_monto_prom=0;

    for(let y in promdetalle){
        if(codigos.includes(promdetalle[y][0])){
            let check_monto_prom=promdetalle[y][1];///UNIDADES MINIMAS QUE PIDE LA PROMO
            let check_monto_dsct=Number(promdetalle[y][2])///recuperado el descuento que se le otorga por promo  
            let check_monto_item=cotdetalle[promdetalle[y][0]]["cantidad"];
            let check_monto_precio=cotdetalle[promdetalle[y][0]]["preciosinIGV"];
            ////esto solo sera para agregar el nombre del producto al cual se le esta aplicando la promo
            let check_monto_nombre=cotdetalle[promdetalle[y][0]]["descripcion"];
            participantes++;
            if(Number(check_monto_prom)>Number(check_monto_item)){
                const falta=Number(check_monto_prom)-Number(check_monto_item);
                if(faltante_minimo===null || falta<faltante_minimo) faltante_minimo=falta;
            }
            if(Number(check_monto_prom)<=Number(check_monto_item)){
            ///aca le estoi agregando al final el monto que le pide como minimo la promo lo usare en el bucle de abajo
        items_correspondientes[promdetalle[y][0]]=[check_monto_item,check_monto_precio,check_monto_prom,check_monto_dsct,check_monto_nombre];
            }
        }
    }
    ///hace esto porqe necesita recojer de todos pero ahora solo necesita de 1x1
    let contador_momentane=0;
    for(let x in items_correspondientes){
        let unidades_minimas= items_correspondientes[x][2];
        let tengo_esta_cantidad= items_correspondientes[x][0];
        let cantidad_descuento= items_correspondientes[x][3];
        let division=Math.floor(Number(tengo_esta_cantidad)/Number(unidades_minimas));
        /////antes era: division*cantidad_descuento, que trataba todo como monto fijo
        /////y ademas devolvia el monto CON IGV. La regla vive ahora en beneficio.js
        let valorizado_item= items_correspondientes[x][1];
        /////aqui el umbral esta en unidades, asi que la base del porcentual es el valor
        /////de las unidades que calificaron: (valor por unidad) x (veces x unidades minimas)
        let valor_unitario= Number(tengo_esta_cantidad)>0 ? Number(valorizado_item)/Number(tengo_esta_cantidad) : 0;
        let base_porcentual= valor_unitario*division*Number(unidades_minimas);
        let corresponde= beneficio.calcular(tipopromo,{veces:division,umbral:unidades_minimas,base:base_porcentual,dsct:cantidad_descuento});

        objeto_regresar[contador_momentane]={}
        objeto_regresar[contador_momentane]["codigo"]=tipopromo["idprom"];
        objeto_regresar[contador_momentane]["descripcion"]=tipopromo["nombre"];
        objeto_regresar[contador_momentane]["cantidad"]=division;
        objeto_regresar[contador_momentane]["montoDescuento"]=corresponde;
        objeto_regresar[contador_momentane]["monedaDescuento"]="D";
        objeto_regresar[contador_momentane]["itemdescr"]=items_correspondientes[x][4];
        tipopromo["descuento"]==1 ? objeto_regresar[contador_momentane]["tipo"]=["descuento"] : objeto_regresar[contador_momentane]["tipo"]=["regalo"];
        contador_momentane++;
    }
    if(Object.keys(objeto_regresar).length>0){
        ////esta linea es para ver si pasa la funcion 1 en el frontend
        // let objeto_regresar2={};
        // objeto_regresar2["items"]=Object.values(objeto_regresar);
        ////sumado para saber si es descuento o regalo, si es 1 es descuento y si es 2 es regalo
        tipopromo["descuento"]==1 ? objeto_regresar["tipo"]=["descuento"] : objeto_regresar["tipo"]=["regalo"];
        objeto_regresar["descripcion"]=tipopromo["nombre"];
        return objeto_regresar;
    }
    else{
        return no_aplica(participantes,faltante_minimo,"unidades");
    }
}

function m_unidades(nprom,cotdetalle,promcabesa,promdetalle,tipopromo,tipometrica,numero_item){
    ///////////SOLO PARA LOS TOTALISADOS DE LA CABESERA
    let numero_documento;
    let cabesatota=0;
    let cabesatotn=0;
    ////////////////////////////////
    let n_item=numero_item+1;
    let items_validos2={};
    let items_promos2={};
    let promo_terminada

    for(let x in cotdetalle){
        ///capturando todos los montos del detallado
        numero_documento=cotdetalle[x][2]
        cabesatota+=parseFloat(cotdetalle[x][16]);
        cabesatotn+=parseFloat(cotdetalle[x][18]);

        for(let y in promdetalle){
            if(promdetalle[y][0]==cotdetalle[x][9]){
                let check_monto_prom=promdetalle[y][1];
                let check_monto_item=cotdetalle[x][14];
                let diferenciar_bonificacion=cotdetalle[x][13].substring(0,11);
                if(check_monto_item>=check_monto_prom && diferenciar_bonificacion!="GRATIS/PROM"){
                    items_validos2[cotdetalle[x][9]]=items_aceptados(cotdetalle[x],promdetalle[y],check_monto_item,check_monto_prom,n_item);
///////variable construida para separar q descuento le toca en especifico con el item identicado en el detallado de la prom
                    items_promos2[promdetalle[y][0]]=[promdetalle[y][0],promdetalle[y][1],promdetalle[y][2],promdetalle[y][3],promdetalle[y][4],promdetalle[y][5],promdetalle[y][6],promdetalle[y][7]];
                    n_item++;
                }
            }
        }
    }
    return [items_validos2,items_promos2,numero_documento,cabesatota,cabesatotn];

}

function items_aceptados(cotdetalle,promdetalle,check_monto_item,check_monto_prom,numero_item){
    let division=check_monto_item/check_monto_prom;
    let cantidad_promocion=Math.floor(division);
    //////////////////fecha,cdocu,ndocu,codcli,tcam,descripcion item,item,cant
    return [cotdetalle[0],cotdetalle[1],cotdetalle[2],cotdetalle[3],cotdetalle[4],cotdetalle[13],numero_item,cantidad_promocion];
}

module.exports=descuento_correspondiente;

/////Separa los dos casos que antes compartian el mismo mensaje:
/////  - ningun producto del carrito participa en la promocion
/////  - participan, pero no llegan al minimo (y ahi se informa cuanto falta)
function no_aplica(participantes,faltante,unidad){
    if(participantes===0){
        return {aplica:false, motivo:"no_participa",
                mensaje:"ninguno de los productos del carrito participa en esta promocion"};
    }
    const f = (faltante===null || !isFinite(faltante)) ? null : Number(faltante.toFixed(2));
    let mensaje;
    if(f===null) mensaje="no se alcanza el minimo de la promocion";
    else if(unidad==="unidades") mensaje="faltan "+f+" unidades para alcanzar la promocion";
    else mensaje="falta "+f+" de valorizado para alcanzar la promocion";
    return {aplica:false, motivo:"no_alcanza", faltante:f, unidad:unidad, mensaje:mensaje};
}