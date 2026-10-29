# Grupo 20 — Promociones vigentes

Contrato de las **promociones vigentes del grupo 20** (vendedores de cartera y de cobertura): una lista
de lo que esta en promocion para ofrecer, y el detalle de cada una con sus productos. Implementado y
probado en bdnava08. Solo lectura.

Es **para ofrecer**, no para aplicar: aplicar una promocion a una cotizacion sigue siendo el modulo
`promocion` de siempre (`/promocion/revisar`, `/mostrar`, `/acoplar`). Esta pantalla no toca nada.

---

## 1 · Reglas

| | |
|---|---|
| **Quien** | solo el grupo 20, cartera y cobertura. El grupo 25 y el 34 reciben `403 sin permiso` |
| **Que es vigente** | encendida (`estado = 1`) **y** hoy entre su fecha de inicio y su fecha de fin. Se compara por **dia**, con el dia del servidor de base de datos (hora de Lima): la promocion se ve **todo su ultimo dia**. En bdnava08 hay 25 encendidas pero solo 20 vigentes: las otras 5 ya vencieron |
| **No salen** | las vencidas, las todavia no iniciadas y las que no tienen **ningun producto vigente** |
| **Tipo** | `DESCUENTO` o `REGALO`. **No hay montos**: ni el porcentaje del descuento ni cuanto se regala. Eso lo resuelve el motor al cotizar |
| **Marca y familia** | salen de los **productos**, no del nombre: los nombres no sirven (`TCL PROMO MNT 15231 OCT26`, `ALMAC. 14218 CDK 5+1 OMEGA SUPRESOR DF`). La marca va **tal cual** esta en el sistema: `HEWLETT PACKARD`, `HP-IMPRESORAS`, `HP-MONITORES`. Si una promocion mezclara marcas o familias, llegan juntas con ` / ` (la de mas productos primero). Hoy todas tienen una sola |
| **Stock** | solo `DISPONIBLE` o `AGOTADO`, **nunca el numero**. Disponible = hay stock en alguno de los cuatro almacenes (principal, M&M, Piura y Chorrillos). Es el del **producto en promocion**: en las de regalo no se mira el obsequio. El **detalle** ademas dice **en cuales almacenes** hay, sin cantidades (`almacenes`) |
| **Solo algunos clientes** | `soloAlgunosClientes: true` cuando la promocion es solo para ciertas categorias de cliente (hoy 15221, las botellas HP). **No se dice cuales**: la pantalla muestra la etiqueta *«solo algunos clientes»* |
| **Part number** | si el producto no lo tiene, llega `""` |
| **Orden de la lista** | las que **vencen antes** primero; a igual vencimiento, por familia, marca y nombre |
| **Sin codigos del sistema** | no viajan los codigos internos de producto; para cotizar, el vendedor busca por part number o descripcion |

**Menu:** el grupo 20 trae la clave nueva **`promovigentes`** en `GET /v1/vendedor/cartera` y en
`GET /v1/vendedor/cobertura` (*«Mira las promociones vigentes para ofrecer a tus clientes»*). No usa la
clave `promocion`: esa es adjuntar y retirar promociones en una cotizacion.

---

## 2 · Rutas

### La lista

`GET /v1/promocion/vigentes`

```json
{ "status":"ok", "codigo":0, "data": {
    "fecha": "2026-10-29",
    "total": 20,
    "promociones": [
      { "idprom": "15221",
        "nombre": "HP BOTELLAS Q42026 DSCTO (CDK)",
        "descripcion": "Por la compra de 100 botellas GT52 y GT53, llevas un descuento especial.",
        "tipo": "DESCUENTO",
        "venceEl": "2026-10-31",
        "diasRestantes": 2,
        "soloAlgunosClientes": true,
        "marca": "HEWLETT PACKARD",
        "familia": "SUMINISTROS",
        "productos": 4,
        "disponibles": 4 }
    ]
} }
```

- `idprom` llega como **texto** (igual que en `/promocion/revisar`).
- `nombre` es el que tiene el ERP y a veces no dice nada; `descripcion` explica la promocion. Mostrar las dos.
- `venceEl` es `AAAA-MM-DD`; `diasRestantes` es `0` el ultimo dia. Algunas promociones duran hasta fin de
  año (`2027-01-01`).
- `productos` son los productos vigentes de la promocion y `disponibles` cuantos de ellos tienen stock.
  `disponibles: 0` es una promocion que hoy no se puede ofrecer (en bdnava08 no hay ninguna asi).
- `tipo` puede llegar `null` si el ERP trae un tipo que no es descuento ni regalo (hoy no hay).
- Sin promociones vigentes: `total: 0` y `promociones: []`; no es un error.

### El detalle

`GET /v1/promocion/vigentes/15221`

```json
{ "status":"ok", "codigo":0, "data": {
    "fecha": "2026-10-29",
    "promocion": { "idprom":"15221", "nombre":"HP BOTELLAS Q42026 DSCTO (CDK)", "descripcion":"...", "tipo":"DESCUENTO",
                   "venceEl":"2026-10-31", "diasRestantes":2, "soloAlgunosClientes":true,
                   "marca":"HEWLETT PACKARD", "familia":"SUMINISTROS", "productos":4, "disponibles":4 },
    "productos": [
      { "descripcion":"TINTA HP 1VV22AL BOTTLE (GT53)  BLACK 4000 PAG", "partNumber":"1VV22AL",
        "marca":"HEWLETT PACKARD", "familia":"SUMINISTROS", "disponibilidad":"DISPONIBLE", "almacenes":["PIURA"] },
      { "descripcion":"PSU ANTEC CSK DC GB 550W 80+ BRONZE UK", "partNumber":"0-761345-20103-2",
        "marca":"ANTEC", "familia":"PARTES Y PIEZAS DE COMPUTADORA", "disponibilidad":"AGOTADO", "almacenes":[] }
    ]
} }
```

- `promocion` es la misma fila de la lista. `productos` van ordenados por marca y descripcion, con los
  agotados incluidos: la pantalla decide si los atenua o los oculta.
- `disponibilidad` es `"DISPONIBLE"` o `"AGOTADO"`.
- `almacenes` son los almacenes donde hay stock hoy, **sin cantidades**: `"PRINCIPAL"`, `"M&M"`, `"PIURA"` y
  `"CHORRILLOS"`, siempre en ese orden. Es `[]` cuando el producto esta `AGOTADO`. Un producto puede estar
  `DISPONIBLE` **solo en Piura o en Chorrillos**: hoy pasa con el `1VV22AL` de la 15221 y con el
  `BT50013PK-Q2` de la 15206. Los rotulos son los mismos del reporte de stock del grupo 25. La lista de
  promociones no los trae: solo el detalle.
- Una promocion de **regalo** puede regalar otro producto (la 14106 regala un cable): el detalle muestra
  solo los productos que **se compran**, no el obsequio. Lo que se regala lo explica la `descripcion`.

---

## 3 · Errores

Siempre el JSON de siempre `{ status, codigo, msg }`.

| http | status | cuando |
|---|---|---|
| 401 | `falsa galleta` | no hay sesion |
| 403 | `sin permiso` | no es del grupo 20 |
| 403 | `usuario sin acceso` | el usuario no tiene acceso a la intranet |
| 404 | `promocion no vigente` | el detalle de una promocion que no existe, esta apagada, ya vencio, aun no empieza o no tiene productos vigentes; tambien un `idprom` que no es un numero |
| 500 | `error query` | fallo la consulta |

---

## 4 · El motor de cotizacion tambien respeta las fechas (cambio del 2026-10-29)

Antes, los buscadores de promociones de la cotizacion filtraban solo `estado = 1` y **nunca comparaban las
fechas**: en bdnava08 las 5 promociones encendidas ya vencidas (14898, 15124, 15217, 15218 y 15227) todavia
se podian ofrecer y aplicar en una cotizacion. **Ya no**: la cotizacion usa la misma regla de vigencia que esta
lista (encendida y hoy entre su inicio y su fin, el ultimo dia incluido).

Lo que cambia para el vendedor, en el modulo `promocion` de siempre:

| ruta | con una promocion vencida |
|---|---|
| `POST /promocion/recolector` y `POST /promocion/revisar` | ya no la ofrecen entre las aplicables a los productos. Si era la unica, responden lo de siempre cuando no hay ninguna: `400 ninguna promocion` |
| `POST /promocion/detalle`, `POST /promocion/mostrar` y `POST /promocion/acoplar` | responden `400 promocion no registrada`, con el mensaje *«la promocion no existe, esta desabilitada o ya vencio»* (antes decia *«no existe o esta desabilitada»*) |
| `POST /promocion/eliminar` | **no cambia**: retirar una promocion ya puesta en una cotizacion siempre se puede, aunque haya vencido |

- En la **base principal** (bdnava01) hoy las 43 promociones encendidas estan vigentes: ninguna vencida ni sin
  fecha. El cambio no altera nada hoy; evita que una promocion que se olvide apagar se siga aplicando.
- Una promocion encendida **sin fecha** de inicio o de fin se trata como no vigente (hoy no hay ninguna).
- Una promocion que vence **mientras el vendedor arma la cotizacion** puede dejar de aplicarse entre la
  revision y el momento de acoplarla: la pantalla de cotizacion recibe ese `400` y debe mostrar el mensaje.

---

## 5 · Para probar en bdnava08

| caso | que se ve |
|---|---|
| Un usuario del grupo 20, `GET /promocion/vigentes` | 20 promociones; la primera vence el 2026-10-31 |
| Ninguna de 14898, 15124, 15217, 15218, 15227 | vencidas: no salen |
| `GET /promocion/vigentes/15221` | 4 productos, `soloAlgunosClientes: true`, marca `HEWLETT PACKARD` |
| `GET /promocion/vigentes/14106` | 6 productos, 2 `AGOTADO` (con `almacenes: []`) y 4 `DISPONIBLE` (el `0-761345-20118-6` en `["PRINCIPAL","M&M"]`); `tipo: "REGALO"` |
| `GET /promocion/vigentes/15221` | el `1VV22AL` es `DISPONIBLE` pero solo en `["PIURA"]` |
| `POST /promocion/acoplar` o `/mostrar` con la 14898 | `400 promocion no registrada` (vencida) |
| `GET /promocion/vigentes/14898` | `404 promocion no vigente` (vencida) |
| `GET /promocion/vigentes/abc` | `404 promocion no vigente` |
| Un usuario del grupo 25 o el 126 (grupo 34) | `403 sin permiso` |
| Sin sesion | `401 falsa galleta` |
| La 15257 de produccion | no existe en bdnava08 (la base de prueba va atrasada); en produccion saldra si esta vigente |
