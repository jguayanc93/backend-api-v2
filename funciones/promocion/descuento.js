const beneficio = require('./beneficio');
const {CON_IGV, SKU_DESCUENTO, COT} = require('../comunes/constantes');


function descuento(destino,nprom,cotdetalle,promcabesa,promdetalle,tipopromo,tipometrica,arr,promo){
    
    let items_validos2;
    let items_promos2;
    let numero_documento;
    let cabesatota;
    let cabesatotn;
    ////SI SON DIFERENTES PORQUE EL TAMAÑO ES MENOR
    ////Y EN EL TIPO 3 veo q no tiene el array extraño sobre el detallado de la prom nose porqe
    if(tipopromo[0]==1){
        items_validos2=arr[0];/////detallado inicial de la cotizacion
        items_promos2=arr[1];/////objeto con toda la informacion sobre detallado de la promocion
        numero_documento=arr[2];///un array que contiene la informacion sobre el detallado de la prom porqe???
        cabesatota=arr[3];
        cabesatotn=arr[4];
    }
    else{
        items_validos2=arr[0];
        items_promos2=arr[2];
        numero_documento=arr[3];
        cabesatota=arr[4];
        cabesatotn=arr[5];
    }

    let comodin_dsc='DSCTO/PROM: ';
    let descripcion_acomodada="";

    if(tipopromo[0]==1){
        let comodin_dsc_cabesera=comodin_dsc+promcabesa[1]+"/";
        for(let i in items_validos2){
            /////el monto sale de beneficio.js, la misma regla que usa /detalle,
            /////para que el modal y lo que se graba no puedan diferir
            const veces_i=Number(items_validos2[i][7]);
            const umbral_i=Number(items_promos2[i][1]);
            const dsct_i=Number(items_promos2[i][2]);
            const base_i=valor_de_linea(cotdetalle,i);
            let cantidad_recibir=beneficio.calcular(promo,{veces:veces_i,umbral:umbral_i,base:base_i,dsct:dsct_i})*-1;
            /////beneficio.calcular ya devuelve sin IGV; el con IGV se reconstruye para totn
            let cantidad_recibir_sin_igv=cantidad_recibir.toFixed(2);
            let cantidad_recibir_con_igv=Number((cantidad_recibir*CON_IGV).toFixed(2));
            let comodin_completo=comodin_dsc_cabesera+items_validos2[i][5];
            comodin_completo.length>80 ? descripcion_acomodada=comodin_completo.substring(0,80) : descripcion_acomodada=comodin_completo;
            items_validos2[i].push("D","D","S",SKU_DESCUENTO,"DS00","","",descripcion_acomodada,cantidad_recibir_sin_igv,cantidad_recibir_sin_igv,0.00,cantidad_recibir_con_igv,'01',0,"N",1,"UND","")
            //////////////////mone,moneitem,aigv,codi,codf,marc,umed,descripcion acomodada,preciounitario,tota,descuento,totn,codalm,costo,msto,ucon,ucom,obse
        }
        ////agregar la sumatoria completa para la modificacion de la cabesera aqui
        for(let y in items_validos2){
            cabesatota+=parseFloat(items_validos2[y][17]);
            cabesatotn+=parseFloat(items_validos2[y][19]);
        }
        ///retirado para luego revivir para los descuentos
        items_validos2["descuento"]=[numero_documento,cabesatota,parseFloat((cabesatota*0.18).toFixed(2)),cabesatotn];
        //////////
        destino.entregar(items_validos2)
    }
    else{
        let items_validos3={};
        ///ESTO ES PARA DARLE FORMA AL NOMBRE DE LA PROMOCION
        let comodin_dsc_cabesera=comodin_dsc+promcabesa[1];
        ////ESTO PARA SACAR EL MONTO DE CUANTO SE LE DEBE DESCONTAR SEGUN PROMOCION
        /////antes: veces * (umbral * dsct). Eso solo vale cuando el umbral son unidades;
        /////con umbral en dinero daba un monto mil veces mayor. beneficio.js lo resuelve.
        const veces_t=Number(items_validos2[7]);
        const umbral_t=Number(items_promos2[0][1]);
        const dsct_t=Number(items_promos2[0][2]);
        const base_t=veces_t*umbral_t;
        ////ESTO ES PARA MULTIPLICARLO CON LA CANTIDAD QUE MERECE PREVIAMENTE CALCULADO
        let cantidad_recibir2=beneficio.calcular(promo,{veces:veces_t,umbral:umbral_t,base:base_t,dsct:dsct_t})*-1;
        // console.log("revisar valores",items_promos2[0][1],items_promos2[0][2],items_validos2[7],cantidad_recibir)
        ////ESTO ES PARA KITIARLE EL IGV
        let cantidad_recibir_sin_igv=cantidad_recibir2.toFixed(2);
        let cantidad_recibir_con_igv=Number((cantidad_recibir2*CON_IGV).toFixed(2));
        ////ESTO ES PARA DARLE FORMA AL NOMBRE Y NO SUPERAR LOS 80 CARACTERES
        let comodin_completo=comodin_dsc_cabesera;
        comodin_completo.length>80 ? descripcion_acomodada=comodin_completo.substring(0,80) : descripcion_acomodada=comodin_completo;
        ////ESTO ES PARA LLENAR EL ARRAY CON LOS DEMAS CAMPOS NECESARIOS SUPONGO PARA INSERTARLOS EN EL DETALLADO
        items_validos2.push("D","D","S",SKU_DESCUENTO,"DS00","","",descripcion_acomodada,cantidad_recibir_sin_igv,cantidad_recibir_sin_igv,0.00,cantidad_recibir_con_igv,'01',0,"N",1,"UND","")

        ////ACA ESTA EL PROBLEMA DE LA INDEXACION CON RESPECTO AL FORMATO GENERADO DE LA PROMOCION
        items_validos3[0]=items_validos2;
        
        cabesatota+=parseFloat(items_validos2[17]);
        cabesatotn+=parseFloat(items_validos2[19]);

        items_validos3["descuento"]=[numero_documento,cabesatota,parseFloat((cabesatota*0.18).toFixed(2)),cabesatotn];
        destino.entregar(items_validos3)
    }
}

module.exports=descuento;

/////valorizado sin IGV de la linea de la cotizacion, para la base del descuento porcentual
function valor_de_linea(cotdetalle,codi){
    for(const x in cotdetalle){
        if(String(cotdetalle[x][COT.CODI]).trim()===String(codi).trim()) return Number(cotdetalle[x][COT.TOTA])||0;
    }
    return 0;
}