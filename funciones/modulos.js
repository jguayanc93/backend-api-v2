// const modulos_generales=[cotizacion,facturas,promocion,reporte];
const coti=["cotizacion","Permite manejar cotizaciones"];
const pedi=["pedido","Permite manejar pedidos"];
const factura=["factura","Modifica ciertos campos de la factura"];
const prom=["promocion","Permite adjuntar y retirar promociones"];
const listas=["listas","Lista tus ventas realizadas"];
const cuota=["cuota","Ver el avance de las cuotas"];
const reporte=["reporte","Permite sacar reportes de marcas"];
const despachador=["programador","Permite entregar factura a almacen"];
const marcas=["marcas","Elige y administra tus marcas del mes"];
const ajuste=["ajuste","Pide al especialista de la marca que ajuste el precio de tus cotizaciones y pedidos"];


const grp20={
    [coti[0]]:coti[1],
    [pedi[0]]:pedi[1],
    [listas[0]]:listas[1],
    [factura[0]]:factura[1],
    [prom[0]]:prom[1],
    [cuota[0]]:cuota[1],
    [despachador[0]]:despachador[1],
    [ajuste[0]]:ajuste[1]
}
/////grupo 25: jefaturas y especialistas comparten el mismo menu (decidido el 2026-10-21; vendedor
/////del mes se agrego el 2026-10-22).
/////factura y promocion salieron del menu; sus permisos en permisos.js no se tocaron, porque la
/////pantalla de cotizacion puede usar las rutas de promocion.
const cobertura_marcas=["cobertura","Revisa a que clientes se les vendio cada marca en el mes"];
const ajuste_recibidas=["ajuste","Recibe y responde las solicitudes de ajuste de precio de los vendedores"];
const vendedormes=["vendedormes","Los 3 vendedores que mas venden cada una de tus marcas en el mes"];
const grp25={
    [marcas[0]]:marcas[1],
    [cuota[0]]:"Fija las metas de tus marcas y revisa su avance",
    [reporte[0]]:"Stock, tiempo en almacen, lista de precios y guias de tus marcas",
    [cobertura_marcas[0]]:cobertura_marcas[1],
    [ajuste_recibidas[0]]:ajuste_recibidas[1],
    [vendedormes[0]]:vendedormes[1],
    [coti[0]]:coti[1]
};
/////grupo 34 (jefe de zona, por ahora solo como jefe del grupo 20; decidido el 2026-10-22).
/////pedido, listas, factura, promocion, cuota y programador salieron del menu; sus permisos en
/////permisos.js no se tocaron, como en el grupo 25.
const avance_zona=["avance","Avance de cuota de todos los vendedores del grupo 20"];
const probabilidad_zona=["probabilidad","Probabilidad de que un vendedor llegue a su cuota, comparada con meses anteriores"];
const grp34={
    [coti[0]]:coti[1],
    [avance_zona[0]]:avance_zona[1],
    [probabilidad_zona[0]]:probabilidad_zona[1]
};
// const grp39=[];

const modulos = {};
modulos["grupo20"]=grp20;
modulos["grupo25"]=grp25;
modulos["grupo34"]=grp34;
// modulos["grupo39"]=grp39;

module.exports=modulos;