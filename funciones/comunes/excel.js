const XLSX = require('xlsx');

/////Excel comun a los modulos que exportan (reportes y cobertura del grupo 25).
/////
/////Una hoja con los mismos titulos y el mismo orden de columnas que la respuesta JSON:
/////  - las fechas ("AAAA-MM-DD") como fechas de Excel, no como texto: se pueden ordenar
/////  - los importes como numeros con dos decimales: se pueden sumar
/////  - donde no hay dato, el texto que explica por que (en pantalla un null se explica con texto;
/////    en el Excel una celda vacia no distingue "no existe" de "se perdio el dato")

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/////"2026-01-16" -> numero de serie de Excel. Se calcula a mano en UTC: con objetos Date la
/////libreria corre la fecha un dia segun la zona horaria del servidor.
function serieExcel(texto){
    const [a,m,d] = texto.split('-').map(Number);
    return (Date.UTC(a,m-1,d) - Date.UTC(1899,11,30)) / 86400000;
}

/////opciones: {fechas:[campos], importes:[campos], textoNulo:(campo)=>texto}
function celda(campo, valor, opciones){
    if(valor == null) return {t:'s', v: opciones.textoNulo ? opciones.textoNulo(campo) : ''};
    if((opciones.fechas || []).includes(campo)) return {t:'n', v:serieExcel(valor), z:'dd/mm/yyyy'};
    if((opciones.importes || []).includes(campo)) return {t:'n', v:valor, z:'#,##0.00'};
    if(typeof valor === 'number') return {t:'n', v:valor};
    return {t:'s', v:String(valor)};
}

/////libro({hoja, columnas:[{campo,titulo}], filas:[{...}], fechas, importes, textoNulo, anchas})
/////-> Buffer del .xlsx. "anchas": campos de texto largo (60 de ancho).
function libro(o){
    const hoja = XLSX.utils.aoa_to_sheet([o.columnas.map(c=>c.titulo)]);
    o.filas.forEach((f,i)=>{
        o.columnas.forEach((c,j)=>{
            hoja[XLSX.utils.encode_cell({r:i+1, c:j})] = celda(c.campo, f[c.campo], o);
        });
    });
    hoja['!ref'] = XLSX.utils.encode_range({s:{r:0,c:0}, e:{r:o.filas.length, c:o.columnas.length-1}});
    hoja['!cols'] = o.columnas.map(c=>({wch: (o.anchas || []).includes(c.campo) ? 60 : Math.max(10, c.titulo.length + 2)}));
    const libroExcel = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libroExcel, hoja, o.hoja);
    return XLSX.write(libroExcel,{type:"buffer",bookType:"xlsx"});
}

/////Para el nombre del archivo: solo letras, numeros, guion y guion bajo (va en una cabecera)
function limpio(texto){ return String(texto == null ? '' : texto).replace(/[^A-Za-z0-9_-]/g,''); }

function enviarExcel(res, nombre, buffer){
    res.setHeader('Content-Type', TIPO_XLSX);
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.status(200).send(buffer);
}

module.exports={libro, limpio, enviarExcel}
