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
        default:
            console.error("[error_corrector] mensaje sin case:",mensaje);
            res.status(500).json({"status":"ERROR","codigo":1,"msg":"error interno del servidor"})
            break;
    }
}

module.exports={error_corrector}