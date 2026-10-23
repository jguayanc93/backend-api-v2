const error_corrector=(res,mensaje)=>{

    /////////RECUERDA ENVIAR LAS RESPUESTAS SEGUN EL MENSAJE ASI SABRAS COMO CAPTURARLAS EN EL OTRO LADO

    switch (mensaje) {
        /////El numero de cotizacion ya estaba usado: la secuencia seq_cotizacion_098 va
        /////por detras de mst01cot. Se arregla con
        /////    ALTER SEQUENCE dbo.seq_cotizacion_098 RESTART WITH <ultimo 098- + 1>;
        case "correlativo duplicado":
            res.status(500).json({"status":mensaje,"codigo":1,"msg":"el numero de cotizacion ya existe: la secuencia esta por detras de mst01cot"})
            break;

        case "error query":
            res.status(500).json({"status":mensaje,"codigo":1,"msg":"fallo la ejecucion de una consulta sql"})
            break;

        case "no cdk user":
            res.status(500).json({"status":mensaje,"codigo":1,"msg":"no esta registrado en el navachof"})
            break;

        case "falsa galleta":
            res.status(401).json({"status":mensaje,"codigo":1,"msg":"la galleta no existe en el frasco"})
            break;

        case "no identificado":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"el user no esta registrado en la intranet"})
            break;

        case "cliente no similitudes":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"no se encontro ninguna similitud"})
            break;

        case "cliente no registrado":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"el cliente seleccionado no existe en los registros"})
            break;

        case "producto no similitudes":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"no se encontro ninguna similitud"})
            break;

        case "producto no registrado":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"el producto no existe en los registros"})
            break;

        case "cotizacion no registrada":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"cotizacion inexistente en los registros"})
            break;

        case "promocion no registrada":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"la promocion no existe o esta desabilitada"})
            break;

        case "ninguna promocion":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"ninguna promocion aplicable a estos productos"})
            break;

        case "cuota existe":
            res.status(403).json({"status":mensaje,"codigo":3,"msg":"vendedor tiene un registro de cuota de este mes"})
            break;

        case "promo ya aplicada":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"la promocion ya esta aplicada"})
            break;

        /////estos mensajes ya se lanzaban desde los querys pero no tenian case,
        /////asi que todos terminaban en el 500 generico de abajo
        case "promocion no soportada":
            res.status(422).json({"status":mensaje,"codigo":2,"msg":"este tipo de promocion aun no esta implementado"})
            break;

        case "no promo aplicable":
            res.status(200).json({"status":mensaje,"codigo":0,"msg":"ninguna promocion aplicable a estos productos","items":[]})
            break;

        case "tipcambio no registrado":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"no hay tipo de cambio registrado para hoy"})
            break;

        case "correlativo inexistente":
            res.status(500).json({"status":mensaje,"codigo":1,"msg":"no se pudo obtener el correlativo de cotizacion"})
            break;

        case "coti desconocida":
            res.status(403).json({"status":mensaje,"codigo":3,"msg":"la cotizacion no existe o no pertenece a este vendedor"})
            break;

        case "codigo no existe":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"uno de los productos enviados no existe en los registros"})
            break;

        case "promocion no tiene":
            res.status(200).json({"status":mensaje,"codigo":0,"msg":"la cotizacion no tiene promociones","items":[]})
            break;

        case "atencion no registrada":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"el cliente no tiene contacto de atencion registrado"})
            break;
        case "sin permiso":
            res.status(403).json({"status":mensaje,"codigo":3,"msg":"su grupo no tiene permiso para esta accion"})
            break;
        case "coti no modificable":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"la cotizacion no existe, no es suya o ya no esta abierta para edicion"})
            break;
        case "documento ambiguo":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"el numero de cotizacion debe incluir su serie, por ejemplo 009-00970435"})
            break;
        case "obsequio sin stock":
            res.status(200).json({"status":mensaje,"codigo":0,"msg":"la promocion aplica pero el producto de obsequio no tiene stock disponible","items":[]})
            break;
        case "coti aprobada":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"la cotizacion ya fue aprobada; hay que desaprobarla primero para poder darla de baja"})
            break;
        case "coti ya anulada":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"la cotizacion ya estaba dada de baja"})
            break;
        case "coti no anulable":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"la cotizacion ya fue facturada o convertida en pedido; no se puede dar de baja"})
            break;
        case "baja no aplicada":
            res.status(500).json({"status":mensaje,"codigo":1,"msg":"la baja no llego a aplicarse y se revirtio; la cotizacion quedo como estaba"})
            break;
        case "grupo sin modulos":
            res.status(403).json({"status":mensaje,"codigo":3,"msg":"su grupo todavia no tiene modulos asignados en la intranet; avise a sistemas"})
            break;
        case "flete ya aplicado":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"el pedido ya tiene aplicado el flete de provincia"})
            break;
        case "flete monto insuficiente":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"el pedido no alcanza el monto minimo para el flete de provincia"})
            break;
        case "flete no corresponde":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"a este pedido no le corresponde flete: depende del departamento del cliente y de un monto minimo"})
            break;
        case "pedido desconocido":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"falta el numero de pedido"})
            break;
        case "pedido no modificable":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"el pedido no existe, no es suyo, o ya fue atendido o anulado"})
            break;
        case "pedido sin detalle":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"el pedido no tiene lineas que cambiar de almacen"})
            break;
        case "almacen invalido":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"el almacen no existe o no esta activo"})
            break;
        case "cuota no corresponde":
            res.status(200).json({"status":mensaje,"codigo":0,"msg":"tu tipo de vendedor no lleva cuota mensual","aplica":false})
            break;
        case "cuota ya registrada":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"ya registraste tu cuota de este mes; solo se puede una vez"})
            break;
        /////el cuerpo no traia el campo. El monto se manda en "fijado"
        case "cuota no enviada":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"falta el campo fijado con el monto de la cuota"})
            break;

        case "cuota invalida":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"el monto de la cuota debe ser un numero mayor que cero"})
            break;
        case "cuota no existe":
            res.status(200).json({"status":mensaje,"codigo":0,"msg":"todavia no registraste tu cuota de este mes","debeRegistrar":true,"meta":0,"avance":0,"porcentaje":null})
            break;
        case "coti en soles":
            res.status(200).json({"status":mensaje,"codigo":0,"msg":"las promociones solo se aplican a cotizaciones en dolares; esta va en soles","items":[]})
            break;
        case "campo desconocido":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"no se indico que campo cambiar, o no es uno de los siete editables"})
            break;
        case "factura desconocida":
            res.status(403).json({"status":mensaje,"codigo":3,"msg":"la factura no existe, no es suya, esta anulada o ya tiene guia emitida"})
            break;
        case "cliente ajeno":
            res.status(403).json({"status":mensaje,"codigo":3,"msg":"el cliente no existe o no es de este vendedor"})
            break;
        case "fecha invalida":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"la fecha debe venir como AAAA-MM-DD"})
            break;
        /////registro del usuario en la intranet (/login/registro/completado)
        case "usuario ya registrado":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"este usuario ya esta registrado en la intranet"})
            break;
        case "diferenciador invalido":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"el tipo de vendedor elegido no corresponde a su grupo"})
            break;
        case "jefatura sin familia":
            res.status(403).json({"status":mensaje,"codigo":3,"msg":"no tiene una familia asignada como jefatura; avise a sistemas para que la carguen"})
            break;
        case "marcas invalidas":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"la lista de marcas no es valida: deben ser codigos de marca de 4 digitos, de 1 a 50"})
            break;
        /////marcas del mes del grupo 25 (/v1/marcas)
        case "marcas ya confirmadas":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"ya confirmaste tus marcas de este mes; no se pueden cambiar hasta el mes siguiente"})
            break;
        case "solo jefatura":
            res.status(403).json({"status":mensaje,"codigo":3,"msg":"solo la jefatura de la familia puede hacer esto"})
            break;
        case "destino invalido":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"falta el codusu del especialista, o es el tuyo: tus propias marcas se toman con confirmar"})
            break;
        case "destino no especialista":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"el codusu indicado no es un especialista registrado"})
            break;
        case "estado invalido":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"trabajada debe ser true o false"})
            break;
        case "marca desconocida":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"la marca no existe"})
            break;
        case "marca de otra familia":
            res.status(403).json({"status":mensaje,"codigo":3,"msg":"la marca pertenece a otra familia"})
            break;
        /////reportes por marca (/v1/reporte/marca)
        case "codmar invalido":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"falta el codigo de la marca o no tiene 4 digitos"})
            break;
        case "formato invalido":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"el formato debe ser json o xlsx"})
            break;
        /////cuota por marca (/v1/cuota/marcas)
        case "cuota por marca":
            res.status(200).json({"status":mensaje,"codigo":0,"msg":"tu cuota no se registra aqui: se fija por marca, en tu cuota por marca","aplica":false,"ruta":"/v1/cuota/marcas"})
            break;
        /////ajuste de precio (/v1/ajuste)
        case "fechas invalidas":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"las fechas deben venir como AAAA-MM-DD, existir, y desde no puede ser posterior a hasta"})
            break;
        case "tipo invalido":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"el tipo debe ser COT (cotizacion) o PED (pedido)"})
            break;
        case "documento desconocido":
            res.status(403).json({"status":mensaje,"codigo":3,"msg":"el documento no existe o no es tuyo"})
            break;
        case "documento no ajustable":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"el documento ya no se puede ajustar: la cotizacion ya fue aprobada, o el pedido ya fue aprobado, facturado o anulado"})
            break;
        case "documento en ajuste":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"el documento esta en ajuste de precio: no se puede modificar hasta que respondan o venza la solicitud"})
            break;
        case "sin responsables":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"ninguna marca del documento tiene un especialista o jefatura que la vea este mes"})
            break;
        case "solicitud desconocida":
            res.status(404).json({"status":mensaje,"codigo":2,"msg":"la solicitud no existe o no te fue enviada"})
            break;
        case "solicitud cerrada":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"la solicitud ya fue respondida, vencio o se cerro"})
            break;
        case "ajuste vacio":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"no se envio ninguna linea para ajustar; si no hay cambios, rechaza la solicitud"})
            break;
        case "linea ajena":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"una de las lineas no es de esta solicitud, o viene repetida"})
            break;
        case "precio invalido":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"el precio debe ser un numero mayor que cero"})
            break;
        case "precio bajo costo":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"el precio no puede quedar por debajo del costo del producto"})
            break;
        case "costo desconocido":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"no se encontro el costo del producto en el almacen de la linea"})
            break;
        case "cantidad invalida":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"la cantidad debe ser un numero entero de 1 o mas"})
            break;
        case "cantidad no ajustable":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"en un pedido solo se ajusta el precio, no la cantidad"})
            break;
        case "observacion requerida":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"al rechazar hay que explicar por que en la observacion"})
            break;
        case "mes no disponible":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"solo se puede consultar el mes en curso y el anterior; anno y mes van juntos"})
            break;
        case "usuario sin acceso":
            res.status(403).json({"status":mensaje,"codigo":3,"msg":"este usuario todavia no tiene acceso a la intranet"})
            break;
        case "vendedor requerido":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"falta codusu: el vendedor del grupo 20 que se quiere revisar"})
            break;
        case "vendedor desconocido":
            res.status(404).json({"status":mensaje,"codigo":2,"msg":"ese codusu no es un vendedor del grupo 20"})
            break;
        case "periodo invalido":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"solo se puede consultar el mes en curso y los dos anteriores; anno y mes van juntos"})
            break;
        case "sin marcas en ese mes":
            res.status(200).json({"status":mensaje,"codigo":0,"msg":"no tuvo marcas asignadas en ese mes","marcas":{}})
            break;
        case "meta solo del dueno":
            res.status(403).json({"status":mensaje,"codigo":3,"msg":"solo quien tiene la marca este mes puede fijar su meta"})
            break;
        case "marcas sin confirmar":
            res.status(409).json({"status":mensaje,"codigo":3,"msg":"primero confirma tus marcas del mes; despues podras fijar sus metas"})
            break;
        case "meta invalida":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"las metas deben ser numeros mayores que cero (para quitar una meta se manda vacia); las unidades, enteras; el margen en % no puede pasar de 100"})
            break;
        case "meta vacia":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"no se envio ninguna meta: monto, margen, margenPct o unidades"})
            break;
        case "rango invalido":
            res.status(400).json({"status":mensaje,"codigo":2,"msg":"las fechas deben venir como AAAA-MM-DD, desde no puede ser posterior a hasta, y el periodo no puede pasar de 3 meses"})
            break;
        case "marca no disponible":
            res.status(403).json({"status":mensaje,"codigo":3,"msg":"esta marca no esta entre las que puede consultar este mes"})
            break;
        /////no tener marcas en el mes no es un error: la pantalla debe abrirse y pedir que las elija
        case "sin marcas del mes":
            res.status(200).json({"status":mensaje,"codigo":0,"msg":"no tiene marcas asignadas este mes","debeAsignar":true,"marcas":{}})
            break;
        default:
            console.error("[error_corrector] mensaje sin case:",mensaje);
            res.status(500).json({"status":"ERROR","codigo":1,"msg":"error interno del servidor"})
            break;
    }
}

module.exports={error_corrector}