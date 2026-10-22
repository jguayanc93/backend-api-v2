# Reportes por marca — cierre del módulo y nuevo informe de Guías

Responde a [reportes-grupo25.md](reportes-grupo25.md). Es el estado del módulo, **lo que
necesitamos de ustedes para darlo por cerrado**, la petición de un **cuarto informe, Guías**, y las
sugerencias que han salido al construirlo.

**Estado:** la pantalla de los tres informes que ya definieron —stock, tiempo en almacén y lista
de precios— está construida y probada contra un simulacro de su documento
(`dev/simulador-reportes.js`, con un `.xlsx` real), y revisada en un navegador. **El informe de
Guías está por definir con ustedes** (sección 4·D). **Nada sale a producción hasta que estén
terminados los módulos del grupo 25 y probados en el servidor de prueba**; el orden y el aviso para
retirar las rutas antiguas están en la sección 6.

| | |
|---|---|
| [1 · Qué falta para cerrarlo](#1--qué-falta-para-cerrarlo) | quién tiene cada cosa |
| [2 · Cómo leemos su documento](#2--cómo-leemos-su-documento) | para que corrijan lo que esté mal |
| [3 · Lo que cambió](#3--lo-que-cambió) | el código interno ya no se ve en la tabla |
| [4 · Lo que necesitamos de ustedes](#4--lo-que-necesitamos-de-ustedes) | aclaraciones, acceso, datos de prueba y **el informe de Guías** |
| [5 · Sugerencias](#5--sugerencias) | las que dependen de ustedes y las nuestras |
| [6 · Cierre y salida a producción](#6--cierre-y-salida-a-producción) | cómo damos el módulo por terminado |

---

## 1 · Qué falta para cerrarlo

| pieza | de quién | estado |
|---|---|---|
| La pantalla: tres informes, verlos y exportarlos | frontend | **hecha**, probada con simulacro |
| **El informe de Guías**: qué son, periodo, filas y columnas | backend | **por definir** (4·D) |
| La pestaña de Guías | frontend | espera su contrato |
| Cuatro aclaraciones sobre su documento | backend | **sin respuesta** (4·A) |
| Cómo llegamos al servidor de prueba | los dos | por definir (4·B) |
| Usuarios y marcas concretos para cada caso | backend | por pedir (4·C) |
| Recorrer la pantalla contra bdnava08 y abrir el Excel en Excel | frontend | espera lo anterior |
| Salida a producción y retiro de las rutas antiguas | los dos | cuando termine el grupo 25 |

**Nada de lo que falta bloquea que sigamos con los demás módulos del grupo 25.**

---

## 2 · Cómo leemos su documento

| tema | lo que entendemos |
|---|---|
| **Qué marcas entran** | Especialista: las asignadas este mes, las haya confirmado o no. Jefatura: las suyas y las asignadas a especialistas **que son de su familia**. No entran las libres de su familia ni las marcas de otra familia que tenga uno de sus especialistas |
| **Sin marcas en el mes** | No hay reportes, ni los del mes pasado. **Es una regla de negocio confirmada**, no un fallo: la pantalla lo explica y ofrece ir a Marcas |
| **Cómo se piden** | `GET /reporte/marca` para la lista; `POST /reporte/marca/{stock,tiempo,precios}` con `{ codmar, formato }`. Solo `codmar`: no mandamos nombres |
| **Ver** | `formato: "json"`. Una sola tabla genérica para todos los informes, con `columnas` (orden y encabezado) y `filas` (por `campo`) |
| **Exportar** | `formato: "xlsx"`. Pedimos la respuesta sin interpretar y **miramos el `Content-Type`**: si es la hoja de cálculo la guardamos con el nombre de `Content-Disposition`; si es JSON es un error y mostramos su `msg` |
| **Agrupar por especialista** | Por `dueno.codusu`, **nunca por nombre**: el mismo especialista figura como `HUARANCCA SAMUEL` aquí y como `SAMUEL HUARANCCA MEZA` en `/marcas` |
| **Importes** | Todo en dólares y sin IGV, con `$`. El **stock negativo se pinta tal cual**, sin corregirlo |
| **Totales** | Los que trae el backend (`total`, `stock`). No sumamos nada del lado del cliente |
| **Tiempo, `null`** | «sin compra desde *kardexDesde*» (hoy 2023), con el valor de `data.kardexDesde`, no escrito a mano |
| **Precios, `null` frente a `0`** | `null` es «—» (no está dado de alta en ese almacén); `0` es `$ 0.00`. Son distintos, como indican |
| **Guías** | Un cuarto informe con **la misma forma** que los demás (`columnas` y `filas`), para que la misma tabla lo pinte sin cambios. Ver 4·D |

---

## 3 · Lo que cambió

**La tabla ya no muestra `CODIGO`**, el código interno del producto: a quien consulta no le sirve.
**`CODF`, el código de fábrica, sí se ve**, y es la primera columna, la que queda fija al desplazar
en el móvil. El buscador de la tabla busca por `CODF`, descripción y part number.

**El Excel conserva todas las columnas, `CODIGO` incluido.** Es la exportación de datos, y ahí el
código interno sirve para cruzar con el ERP. **No necesitamos nada de ustedes por esto**; si
prefieren que el Excel tampoco lo lleve, es un cambio de su lado.

---

## 4 · Lo que necesitamos de ustedes

### A · Cuatro aclaraciones

**1 · «Pedidos» en el stock disponible.** La definición dice *disponible = físico − separado para
venta − pedidos*, y la columna `ordenado` es «unidades pedidas al proveedor». Con la misma palabra
para dos cosas distintas, no sabemos si el «pedidos» que se resta es el de **clientes aún sin
facturar** o el del proveedor. Va en el texto de ayuda de la pantalla, y preferimos no inventarlo.

**2 · Las celdas `null` del Excel.** En pantalla ponemos el texto que explica un `null`. En el
Excel **no tenemos sitio para esa explicación**: lo que se ve es una celda vacía, y no se distingue
«sin compra desde 2023» de un dato perdido. ¿Pueden escribir un texto en la celda, o poner una nota
en la hoja? Afecta sobre todo a `ultimaCompra` y `dias`. Si no, lo documentamos en la ayuda de la
pantalla.

**3 · Sin marcas, en las rutas de informe.** Su sección 1·g dice que sin marcas responde `sin
marcas del mes` + `debeAsignar`; su tabla de errores no lo lista y sí lista `403 marca no
disponible`. Si alguien sin marcas manda un `codmar`, ¿cuál de los dos recibe? Es poco frecuente
(solo si cambia el estado entre que se pinta la lista y se pide el informe); tratamos los dos.

**4 · Qué precio es «valor venta».** La lista de precios trae `VALOR VENTA PRINCIPAL US$` y `VALOR
VENTA M&M US$`. Quien la lea se preguntará si es el precio de lista, si lleva algún descuento o a
qué cliente corresponde. ¿Pueden definirlo en una línea? Es lo que pondríamos en el texto de ayuda
de la pantalla.

### B · Cómo llegamos al servidor de prueba

El frontend, abierto desde `127.0.0.1`, habla con `http://127.0.0.1:3000/v1`. Para recorrerlo contra
bdnava08 necesitamos saber **cómo lo hacen ustedes**:

- ¿Levantan su backend de pruebas en ese puerto, o hay una URL de prueba?
- Las cookies `cdk` y `tip` son `Secure` + `SameSite=None` y **no viajan por `http` local**.
  `login-y-modulos.md` menciona una configuración alterna en `cors/conf.js`. ¿Está lista para
  probar? Y si hay una URL de prueba, ¿pueden incluir en su CORS `http://127.0.0.1:8080`?

### C · Usuarios y marcas concretos para cada caso

Con estos casos recorremos la pantalla contra datos reales. **Díganos, para cada fila, un usuario y
una marca que la cumplan**:

| caso | qué comprobamos |
|---|---|
| Especialista con marcas **asignadas pero sin confirmar** | que cuentan (su regla 1·a) |
| Especialista con marcas confirmadas | el camino normal |
| Especialista **sin ninguna marca** este mes | `sin marcas del mes` y el botón a Marcas |
| Jefatura con 2 o más especialistas con marcas de su familia | el filtro por especialista |
| Un especialista con una marca de **otra** familia, y una marca libre de la familia de su jefatura | que **no** entren en la lista de la jefatura |
| Usuario del grupo 25 **sin registrar** | `400 no identificado` |
| Usuario de **otro grupo** | `403 sin permiso` |
| Marca **sin productos vigentes** | la tabla vacía |
| Producto con **stock negativo** | la cifra en rojo |
| Producto **sin alta en M&M** y producto con **precio en 0** | `null` frente a `0` |
| Producto **sin compra** en los años revisados | el `null` de `ultimaCompra` y `dias` |
| La **marca más grande** (712 productos) | el tiempo de respuesta y el desplazamiento en móvil |
| Una marca **con guías** en el periodo, y otra **sin ninguna** | la tabla de guías y el caso vacío |
| Una guía **anulada**, y una guía con productos de **varias marcas** | cómo se tratan las anuladas, y que solo cuenten las líneas de esa marca |

### D · El informe de Guías

**Lo que queremos.** Un cuarto informe, junto a Stock, Tiempo y Precios, que para una marca muestre
**las guías que contienen productos de esa marca**. Mismas reglas que los demás: la marca tiene que
estar entre las que la persona puede consultar este mes, se ve en pantalla y se exporta a Excel, y
es de solo lectura.

**Lo que no sabemos y necesitamos que definan:**

1. **Qué guías.** ¿Guías de remisión de salida (despacho a clientes), guías de ingreso de
   proveedores, traslados entre almacenes? ¿Todas, o solo algunas? Si son varias, ¿un campo `tipo`
   en el mismo informe, o informes aparte?
2. **Qué periodo.** Una guía es un hecho con fecha, no una foto como el stock: sin acotar, una marca
   puede tener miles. Proponemos `desde` y `hasta` (`AAAA-MM-DD`), con **el mes en curso por
   defecto** y un máximo de rango que decidan ustedes. Si el periodo es fijo («los últimos 30
   días»), también nos sirve, pero necesitamos saberlo para decirlo en pantalla.
3. **Qué es una fila.** Una por guía, con cuántos productos y cuántas unidades **de esa marca**
   lleva, o una por línea (guía × producto). Proponemos **una por guía**, y que el detalle (los
   productos de esa guía) sea una segunda ruta si hace falta.
4. **Qué estados entran.** ¿Las anuladas? ¿Las pendientes de entrega y las ya entregadas? ¿Hay un
   campo de estado?
5. **Qué se muestra de la guía.** Una guía lleva cliente, dirección, transportista y a veces
   valores. ¿Qué puede ver un especialista y qué una jefatura? Preferimos **no mostrar importes**,
   pero lo deciden ustedes.
6. **Volumen y tiempo.** Con el periodo propuesto, ¿cuántas guías tiene al mes la marca más movida?

**Propuesta de contrato**, para que la acepten o la cambien. Misma forma que los otros tres:

```json
POST /v1/reporte/marca/guias
{ "codmar": "0008", "desde": "2026-10-01", "hasta": "2026-10-31", "formato": "json" }
```

`desde` y `hasta` son opcionales. La respuesta va en el mismo sobre, con las mismas reglas
(`columnas` en el orden de mostrarse, filas con nombres, números como números, `null` para lo que no
existe):

```json
{ "status":"ok", "codigo":0, "data": {
    "informe": "guias",
    "marca": { "codmar":"0008", "abrmar":"EPSON", "nombre":"EPSON", "familia":"SUMINISTROS" },
    "anno": 2026, "mes": 10,
    "generado": "2026-10-16T20:14:03.512Z",
    "desde": "2026-10-01", "hasta": "2026-10-31",
    "columnas": [ { "campo":"fecha", "titulo":"FECHA" }, { "campo":"guia", "titulo":"GUIA" }, ... ],
    "filas": [ { "fecha":"2026-10-14", "guia":"T001-00012345", ... } ]
} }
```

**Columnas propuestas**, que confirmarían o cambiarían con las respuestas de arriba:

| campo | título | qué es |
|---|---|---|
| `fecha` | FECHA | fecha de la guía, `AAAA-MM-DD` |
| `guia` | GUIA | serie y número |
| `tipo` | TIPO | remisión, ingreso, traslado… si hay más de uno |
| `destino` | CLIENTE / DESTINO | a quién va, o de quién viene |
| `almacen` | ALMACEN | almacén de origen o de destino |
| `estado` | ESTADO | anulada, pendiente, entregada… |
| `productos` | PRODUCTOS | cuántos productos distintos **de la marca** lleva |
| `unidades` | UNIDADES | cantidad total **de la marca** en la guía |
| `documento` | DOCUMENTO | factura o pedido asociado, si lo hay |

**Errores:** los mismos de los otros tres (`codmar invalido`, `formato invalido`, `marca no
disponible`, `no identificado`, `sin permiso`, `sin marcas del mes`), más **`rango invalido`** (400)
cuando `desde` es posterior a `hasta` o el rango pasa del máximo.

**Qué hace la pantalla con esto.** Una cuarta pestaña, «Guías», con dos fechas —el mes en curso por
defecto—, la misma tabla, el mismo buscador y el mismo botón de Excel. **No pide ningún formato
especial**: los números salen como números y las fechas `AAAA-MM-DD` se muestran en formato local.
Si el contrato final no lleva fechas (periodo fijo), la pestaña no las ofrece.

**Por qué no la construimos ya.** Sin saber qué guías son ni qué columnas lleva, lo único que
podríamos hacer es adivinar, y es lo que nos ha costado más fallos silenciosos: dar por hecho lo que
significaba cada cosa. Con su respuesta, escribimos primero el simulacro y las pruebas sobre su
contrato, y la pestaña después, como con los otros tres.

---

## 5 · Sugerencias

Ninguna bloquea, y ninguna está hecha. Las decidimos con ustedes o entre nosotros.

### Dependen de ustedes

1. **El número de productos en `GET /reporte/marca`** (`productos`). La lista podría decir «712
   productos» y quien exporta sabría qué esperar. Las marcas sin productos también se verían antes
   de abrirlas.
2. **Un Excel con todos los informes** de una marca, en una hoja por informe, con un solo clic
   (`informe: "todos"`). Quien quiere «todo de esta marca» hoy hace una descarga por informe.
3. **Varias marcas en un mismo informe**, o «todas mis marcas». Un especialista con 15 marcas hoy
   repite el recorrido 15 veces, y una jefatura que quiere ver su familia entera, igual. Lo que
   preguntamos es si es viable con el volumen (712 productos × varias marcas), y con qué límite.
4. **Un umbral de «stock viejo» en el informe de tiempo.** Lo que busca quien mira ese informe es
   qué lleva demasiado tiempo parado. ¿Existe un criterio de negocio (90, 180, 365 días)? Si existe,
   mejor que lo calcule el backend (`antiguedad`) para que la pantalla y el Excel coincidan. Si no
   existe, no destacamos nada.

### De nuestro lado (no necesitan hacer nada)

1. **Ordenar tocando el encabezado**, sobre todo `DIAS` y `TOTAL`, que son los que se consultan
   para decidir.
2. **Filtros rápidos:** «solo con stock» y «solo negativos» en stock; «más de N días» en tiempo.
3. **`FAMILIA` al final de la tabla.** En el móvil ocupa el sitio de las cifras: hoy hay que
   desplazar para ver el stock.
4. **Recordar la última marca elegida** al volver a la pantalla.

---

## 6 · Cierre y salida a producción

**Damos el módulo por cerrado cuando:**

- [ ] el informe de Guías está definido y construido, o descartado por escrito
- [ ] las cuatro aclaraciones están respondidas y reflejadas en la ayuda de la pantalla
- [ ] hay una forma de probar contra bdnava08 y los casos de la sección 4·C están recorridos
- [ ] el Excel real se abre en Excel, con las fechas y los importes como números
- [ ] la marca más grande responde y se desplaza bien en un móvil
- [ ] las sugerencias que se acepten están hechas, o descartadas por escrito

**Salida a producción, cuando termine el grupo 25 y se pruebe todo en el servidor de prueba:**

1. Subimos la pantalla nueva y **avisamos**.
2. Retiramos de nuestro lado las cuatro constantes antiguas (`rutamarcas`, `rutastock`,
   `rutatiempo`, `rutamarcaprecios`) y `js/reporte/`: **ya están retiradas**; nada más las llamaba.
3. A partir del aviso, pueden retirar `/reporte/marcas`, `/stoc`, `/tiempo` y `/precios`.

**Backend y frontend tienen que salir el mismo día.** Sus rutas nuevas están hechas y probadas en
bdnava08; hasta que salgan a producción, la pantalla nueva llamaría a rutas que no existen allí, y
la antigua llama a las que van a retirar. En la ventana entre una y otra los reportes dejan de
funcionar, y no es un fallo que avise.

Mientras tanto, la pantalla antigua sigue mostrando los días de tiempo en almacén con el error
que describen en su sección 5. Es del lado del backend de quien depende el calendario.

Un detalle de nombres: `/reporte/marcas` (plural, la antigua) y `/reporte/marca` (singular, la
nueva) conviven y se parecen demasiado. Lo tenemos en cuenta en el código; lo decimos porque es
una confusión fácil de cometer también al leer un registro.
