# Grupo 20 — Lista de precios

Contrato de la **lista de precios del grupo 20** (vendedores de cartera y de cobertura). Es una sola
accion: ver la lista en pantalla o descargarla en Excel. Implementado y probado en bdnava08. Solo
lectura.

**La lista puede llegar a manos de los clientes**, y por eso es distinta del reporte de precios del
grupo 25: **no lleva costo, ni stock real, ni codigos del sistema**.

---

## 1 · Reglas

| | |
|---|---|
| **Quien** | solo el grupo 20, cartera y cobertura. El grupo 25 y el 34 reciben `403 sin permiso`. Los reportes por marca del grupo 25 no cambian |
| **Que productos** | los **vigentes** de las familias habilitadas que **tengan precio**, **haya o no stock**. Si solo salieran los que tienen stock, la hoja delataria el stock |
| **Familias** | `01` accesorios y perifericos, `02` equipos informaticos, `05` suministros, `06` partes y piezas, `09` almacenamiento externo, `11` impresion, `12` movilidad y `13` equipos multimedia. Quedan fuera 03, 04, 10, 00, 07, 08 y 14. La lista vive en el codigo (`FAMILIAS_LISTA_PRECIOS`) |
| **Precio** | el **precio de lista** del **almacen principal**, en **dolares**. Es el valor de venta **antes** del descuento por tipo de cliente: no corresponde a ningun cliente en particular. El precio de M&M no se muestra |
| **IGV** | `precioSinIgv` es el valor de venta; `precioConIgv` es ese precio por 1,18, redondeado a dos decimales con la regla del ERP. Quien multiplique el de la hoja por 1,18 obtiene el otro |
| **Disponibilidad** | la misma en todas las filas: `SUJETO A DISPONIBILIDAD`. No hay stock en la lista |
| **Marca** | tal cual esta en el sistema. Algunas llevan la linea: `HP-IMPRESORAS`, `EP_IMPRESORAS`, `HW-ADATA` (21 de 135 en bdnava08) |
| **Part number** | si el producto no lo tiene, la celda queda **en blanco** (42 productos en bdnava08) |
| **Orden** | familia, marca y descripcion |

**Menu:** el grupo 20 trae la clave nueva **`listaprecios`** en `GET /v1/vendedor/cartera` y en
`GET /v1/vendedor/cobertura` (*«Descarga la lista de precios de venta, sin IGV y con IGV»*). No usa la clave `reporte`: esa es el
menu de reportes por marca del grupo 25, y su ruta `/reporte/marca` le daria `403` a un vendedor.

**Volumen:** en bdnava08 son 6 396 filas y el Excel pesa unos 2,2 MB. No hay paginacion: llega todo.
**Tampoco hay seleccion de familia**: la lista baja siempre completa, con las 8 familias juntas
(confirmado el 28/10/2026 con el grupo). El vendedor filtra en la pantalla o en Excel con la columna
`FAMILIA`.

---

## 2 · Ruta

`POST /v1/reporte/listaprecios`

```json
{ "formato": "json" }
```

`formato` es `"json"` (o se omite) o `"xlsx"`; mayusculas o minusculas da igual.

### Respuesta con `formato: "json"`

```json
{ "status":"ok", "codigo":0, "data": {
    "informe": "listaprecios",
    "fecha": "2026-10-28",
    "generado": "2026-10-28T15:14:03.512Z",
    "columnas": [ { "campo":"descripcion", "titulo":"DESCRIPCION" }, { "campo":"partNumber", "titulo":"PART NUMBER" }, ... ],
    "filas": [
      { "descripcion":"HEADSET 3.5MM PRECOG S-WHCWW", "partNumber":"PRECOG S-WHCWW", "marca":"ADATA",
        "familia":"ACCESORIOS Y PERIFERICOS", "precioSinIgv":18, "precioConIgv":21.24,
        "disponibilidad":"SUJETO A DISPONIBILIDAD" }
    ]
} }
```

- `columnas` va en el orden del Excel; `titulo` es el mismo encabezado. La pantalla puede ocultar u
  ordenar distinto: el Excel conserva todas.
- Los precios llegan como numeros. Un part number que no existe llega como `""`.
- `fecha` es la del servidor (`AAAA-MM-DD`); es la misma que lleva el nombre del archivo.

### Respuesta con `formato: "xlsx"`

El archivo, con `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y
`Content-Disposition: attachment; filename="lista-precios-2026-10-28.xlsx"`.

Una hoja llamada `lista de precios`, con los mismos titulos y el mismo orden que el JSON. Los precios
son numeros con formato `#,##0.00`, asi que se pueden ordenar y sumar. El part number sin dato queda
en blanco.

**Como distinguir un error de un archivo:** el error llega con `Content-Type: application/json` y su
codigo http. Si el `Content-Type` no es el de la hoja, no guardarlo. Es el mismo caso que los reportes
del grupo 25.

---

## 3 · Errores

Siempre el JSON de siempre `{ status, codigo, msg }`, nunca un archivo.

| http | status | cuando |
|---|---|---|
| 400 | `formato invalido` | `formato` no es json ni xlsx |
| 401 | `falsa galleta` | no hay sesion |
| 403 | `sin permiso` | no es del grupo 20 |
| 403 | `usuario sin acceso` | el usuario no tiene acceso a la intranet |
| 500 | `error query` | fallo la consulta |

---

## 4 · Auditoria

**Cada descarga en Excel queda registrada** en `tbl_api_auditoria`: modulo `reporte`, accion
`lista de precios`, el usuario, el dispositivo y el detalle (`xlsx · 6396 filas`). Verla en pantalla
(`formato: "json"`) **no** se registra.

---

## 5 · Para probar en bdnava08

| caso | que se ve |
|---|---|
| Un usuario del grupo 20 con `{"formato":"json"}` | 6 396 filas, 8 familias, sin costo ni stock |
| El mismo con `{"formato":"xlsx"}` | el archivo `lista-precios-AAAA-MM-DD.xlsx`, 7 columnas, 6 396 filas mas el encabezado |
| Sin `formato` | responde como json |
| `{"formato":"pdf"}` | `400 formato invalido` |
| Un usuario del grupo 25 o el 126 (grupo 34) | `403 sin permiso` |
| Producto sin part number | celda en blanco |
| `precioConIgv` | es `precioSinIgv` por 1,18 a un centimo, en las 6 396 filas |
