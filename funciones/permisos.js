/////esto se usara mas adelante para dar ciertos permisos por usuario
// const cotizacion=["crear","leer","update","delete"];
// const pedido=["crear","modificar","eliminar"];
// const factura=["modificar","despachar"];
// const listas=["cotizacion","pedidos","facturas"];
// const promocion=["crear","eliminar"];
// const reporte=["crear"];
// const cuota=["volumen","rentabilidad","cobertura"];
const cotizacion={
    "crear":[20,34,25,32],
    "leer":[20,25,32,34],
    "update":[20,25,34,32],
    "delete":[20,25,34,32],   ////el grupo 20 tambien puede dar de baja, pero solo las suyas: la propiedad la verifica la ruta
    "alm":[20,25,34,32]
}

const pedido={
    "flete":[20,34],
    "alm":[20,25,34,32]   ////mismo criterio que cotizacion.alm
}

// const pedido={
//     "crear":[20,34],
//     "leer":[20],
//     "update":[20,34],
//     "delete":[20,25,34],
//     "alm":[34]
// }

const factura={
    "despacho":[20,25,34],
    "transporte":[20,25,34],
    "atencion":[20,25,34],
    "direccion":[20,25,34],
    "vendedor":[34],   ////reasignar la factura a otro vendedor no es privilegio de vendedor: solo jefatura de zona
    "observacion":[20,25,34],
    "orden":[20,25,34]
}

const promocion={
    "crear":[],
    "leer":[],
    "update":[20,25,34],
    "delete cotizacion":[20,25,34],
    "delete pedido":[20,25,34]
}

const cuota={
    "crear":[20,34],     ////el grupo 25 no registra una cuota de un solo monto: su cuota va por marca
    "leer":[20,25,34],
    "marcas":[25],          ////cuota por marca del grupo 25
    "meta marca":[25],
    "update":[],
    "delete":[]    
}

const lista={
    "cotizacion":[20,25,34],
    "pedido":[20,25,34],
    "factura":[20,25,34],
    "clientes":[20,25,34]
}

const programador={
    "entregar":[20,34],
    "retirar":[]
}

/////marcas del mes del grupo 25. Que sea jefatura o especialista lo decide la consulta:
/////es jefatura quien tiene familia en tbl01_api_jefatura_familia
const marcas={
    "ver":[25],
    "confirmar":[25],
    "asignar":[25],
    "retirar":[25],
    "estado":[25]
}

/////cobertura de clientes del grupo 25 (no es la cuota de cobertura del grupo 20)
const cobertura={
    "clientes":[25]
}

/////ajuste de precio: el vendedor envia cotizaciones y pedidos; el especialista o la jefatura ajusta
/////las claves son tambien las acciones que devuelve GET /ajuste (los accesos de cada grupo)
const ajuste={
    "enviar":[20],       ////enviar y ver la vista previa
    "enviadas":[20],
    "recibidas":[25]     ////recibidas, abrir, confirmar y rechazar
}

/////vendedor del mes: los 3 vendedores del grupo 20 que mas venden cada marca
const vendedormes={
    "ver":[25]
}

const reporte={
    "stock":[25],
    "tiempo":[25],
    "precio":[25],
    "guias":[25],
    "marcas":[25]     ////la lista de marcas que puede consultar
}


const permisos={}
permisos["cotizacion"]=cotizacion;
permisos["pedido"]=pedido;
permisos["factura"]=factura;
permisos["promocion"]=promocion;
permisos["cuota"]=cuota;
permisos["lista"]=lista;
permisos["programador"]=programador;
permisos["reporte"]=reporte;
permisos["marcas"]=marcas;
permisos["cobertura"]=cobertura;
permisos["ajuste"]=ajuste;
permisos["vendedormes"]=vendedormes;

module.exports=permisos;