# Cotización en soles — respuestas y lo construido en la pantalla

Responde a [cotizacion-moneda.md](cotizacion-moneda.md) (sección 6, las cinco preguntas, y la 7, nuestra lista).
**La pantalla está construida y probada contra un simulacro de su propuesta** (`dev/servidor.js` hace lo que
ustedes dicen que va a hacer `/pegar`). **No se ha probado contra bdnava08**: falta la dirección del servidor de
prueba y las claves de las cuentas.

Estamos de acuerdo con la propuesta tal como está. Hay **tres cosas que queremos que confirmen** (sección 3) y
**un orden de salida** que importa (sección 5).

**Nada sale a producción hasta que esté probado en el servidor de prueba**, y backend y frontend salen el mismo día.

---

## 1 · Sus cinco preguntas

**1 · ¿Qué tipo de cambio usa hoy la pantalla para convertir a soles?**
El `tipoCambio` de `/vendedor`, **cuando llega**. Si no llegaba (o llegaba `null` o 0) usaba **un valor fijo de reserva,
3.408, en silencio**: el vendedor veía soles con un cambio que el backend nunca iba a usar. Eso se acabó (pregunta 5).

Lo que mostraba para la 098-00000069, con tc 3.45, según el código (no vimos la pantalla del vendedor): **S/ 13 894.67
sin IGV, S/ 2 501.04 de IGV y S/ 16 395.71 de total**, que son los de su tabla. Coincidían, pero **por casualidad de
ese caso**, no porque el método fuera bueno: la pantalla convertía **el total en dólares ya redondeado**
(`4 027.44 × 3.45`), y el ERP convierte **el precio unitario** y recalcula desde ahí. Con una línea de 7 unidades a
US$ 89.90 y 4 % de descuento, la pantalla decía S/ 2 084.25 sin IGV y el ERP graba **S/ 2 084.24**. En una simulación
nuestra de 200 000 carritos (1 a 5 líneas, precios de 1 a 600 US$, cantidades de 1 a 100) **la pantalla de antes
difería del ERP en algún total en el 91 %**, hasta en 29 céntimos. Es una simulación con nuestros supuestos, no datos reales.

**2 · ¿Siguen mandando a `/pegar` los precios en dólares?**
**Sí, siempre**, esté como esté el selector. El cuerpo no cambia:

| campo | qué lleva |
|---|---|
| `moneda` | `"D"` o `"S"`, la que muestra el selector (y **solo** `"S"` si hoy hay tipo de cambio) |
| `productos[i].precioUnitario` | **US$**, el precio del producto para ese cliente |
| `productos[i].cantidad` · `descuento` | cantidad y descuento en %, el que el vendedor tecleó (acotado al tope del producto) |
| `productos[i].preciosinIGV` | importe de la línea **en US$**, ya con el descuento y a 2 decimales |

**Para soles, calculen desde `precioUnitario`, `cantidad` y `descuento`, no conviertan `preciosinIGV`**: convertir ese
importe ya redondeado es justo el error de la pantalla de antes. El costo no viaja: lo toman ustedes (`pcus`).

**3 · En `/update`, para una cotización en soles, ¿qué mandan?**
*Antes:* la línea nueva salía tal como la da `/producto/encontrado`, **en dólares** (`preu` = `p[8]`, `cost` = `p[10]`, e
importes en dólares), con los `mone`/`tcam` de la cabecera repetidos en cada línea. Era la mezcla de monedas que describen.

*Ahora, en una cotización en soles*, la línea nueva se convierte con **el `tcam` de esa cotización** (nunca el del día):

| posición de `/update` | línea nueva en soles |
|---|---|
| 5 `tcam` | el de la cabecera, como lo dio `/read` |
| 6 `mone` · 7 `moneitm` | los de la cabecera, **como los dio `/read`** (en las del ERP `S` y `D`); ustedes los toman de la cabecera e ignoran estos |
| 16 `preu` | `round3(vvus × tcam)` |
| 17 importe de la línea | `round2(preu × cantidad × (1 − dsct/100))` |
| 19 importe con IGV | `round2(importe × 1.18)` |
| 21 `cost` | `round3(pcus × tcam)` |

**Las líneas que ya estaban se devuelven como las dio `/read`**; si se cambia su cantidad, el importe se recalcula desde su
`preu` en soles (sin pasar por dólares). Si la cotización en soles **no trae `tcam`** (null o 0), **no dejamos agregar
productos** y lo decimos. En dólares **nada cambia**.

Un hallazgo que no estaba en su documento: la pantalla decidía la moneda del documento con `moneitm || mone`, y en una
cotización en soles **hecha en el ERP** `moneitm` es `D`, así que **«Ver» y «Modificar» la enseñaban con el símbolo `$`**
aunque los importes ya estaban en soles. Ahora manda **`mone`** (la del documento), como dicen. Y el precio unitario se
enseña **con 3 decimales** (`S/ 27.497`, no `27.50`), porque a 2 el precio por la cantidad no da el importe.

**4 · ¿Está el selector de moneda al editar?**
**No existe.** El único selector de moneda está en la cotización nueva; en «Modificar» la moneda sale de la cabecera. Para
que se entienda, el encabezado dice **«Soles · T.C. 3.450»** cuando el documento va en soles. No hay nada que ocultar.

**5 · Con `tipoCambio` en `null`, ¿deshabilitar soles?**
**Sí, hecho.** La opción PEN queda desactivada y aparece el aviso *«Hoy no hay tipo de cambio cargado: solo se puede
cotizar en dólares.»* Aunque el navegador restaure «PEN» al recargar, queda en dólares. **El 3.408 fijo ya no existe.**
Con `tipoCambio` en `null`, `/pegar` falla **también en dólares** (`tipcambio no registrado`): hoy mostramos su `msg` al
intentar crear y el carrito no se pierde. Si prefieren que avisemos antes de llegar ahí, díganlo.

---

## 2 · Su lista de cambios del frontend (sección 7), uno por uno

| su punto | estado |
|---|---|
| Convertir en pantalla con `tipoCambio` y la regla de la sección 4 | **Hecho.** Precio unitario a 3 decimales, línea a 2, IGV y total sobre la suma. Ver «Cómo lo comprobamos» |
| Mostrar los `totales` que devuelve `/pegar` | **Hecho**, en el aviso de «Cotización generada»: *Total sin IGV · IGV · Total · Tipo de cambio* en la moneda del documento. **Solo si la respuesta trae `moneda`**: mientras no lo traiga (o con el backend de hoy) no se muestra ni se calcula nada |
| No volver a convertir lo que devuelve `/read` | **Hecho**: «Ver», «Modificar» y el documento imprimible usan `mone` y no multiplican |
| En `/update`, convertir las líneas nuevas con el `tcam` del documento | **Hecho** (pregunta 3) |
| Deshabilitar soles si `tipoCambio` es `null`; ocultar el selector al editar | **Hecho** (preguntas 4 y 5) |
| Promociones solo en dólares | **Hecho**: en soles el botón «Buscar promociones» se desactiva con la nota *«Las promociones solo se aplican a cotizaciones en dólares»*. **Si ya había promociones aceptadas, al elegir soles se retiran** y se avisa. Su bloqueo en `/promocion/acoplar` queda como segunda barrera |

También corregimos un fallo nuestro: al crear, la moneda volvía a dólares **solo en una variable**, no en el selector, así
que la cotización siguiente **se veía en soles y se mandaba en dólares**. Ahora el selector vuelve a dólares y la moneda que
se manda sale de la misma fuente que los importes de la pantalla.

### Cómo lo comprobamos

- **Contra una referencia de enteros exactos** (centavos, milésimas, décimas de %), no contra otra fórmula con coma
  flotante: 60 000 carritos en la suite y 300 000 en una medición aparte, **0 diferencias**.
- **Eso nos hizo cambiar el cálculo.** Con coma flotante, `7.97 × 3.45` y similares quedan en `…499999` y se redondean
  mal: **difería del decimal exacto en el 5 % de los carritos** (p. ej. `3.05 × 3.45 = 10.5225`, que el ERP redondea a
  `10.523` y la coma flotante a `10.522`). Ahora se calcula con aritmética decimal exacta. Asumimos que ustedes redondean
  **la mitad hacia arriba**, como un `ROUND` de SQL (pregunta 3 de abajo).
- Los ejemplos de su documento: `0505-012605` (27.497 · 160.86 · cost 25.703) y la 098-00000069 (143.244 · 13 894.67 ·
  2 501.04 · 16 395.71) están como pruebas.
- Suite nueva `dev/pruebas/probar-soles.js` (153 comprobaciones): la regla, la cotización nueva (con y sin tipo de cambio,
  promociones, resultado de `/pegar`), «Modificar» una cotización en soles con una línea nueva y lo que viaja a `/update`,
  y «Ver». Se comprobó rompiendo el código a propósito: cada cambio rompe al menos una prueba.

---

## 3 · Tres cosas que queremos que confirmen

1. **El redondeo.** ¿`round3` y `round2` son **mitad hacia arriba** sobre el valor decimal exacto (como `ROUND` de SQL Server
   con `decimal`)? Es lo que asumimos; si alguna operación va en `float` o trunca, difiere en algún céntimo.
2. **La línea.** ¿Es `round2(preu × cant × (1 − dsct/100))` con `dsct` **tal cual lo mandamos** en `descuento`, y el IGV de
   la cabecera `round2(Σ líneas × 0.18)` y el total `round2(Σ líneas × 1.18)`? Es lo que dice su sección 4.
3. **El impreso del cliente en soles.** El documento imprimible enseña «Precio DSCTO» como el precio con descuento **a
   2 decimales con un 0 de relleno** (`75.720`), como el de siempre. En soles, con `preu` a 3 decimales, queda `26.950`
   y **`18 × 26.95` no da el total de la línea**. No lo hemos tocado: ¿cómo lo muestra el impreso del ERP en soles?

---

## 4 · Cómo probarlo en la demo

`node dev/servidor.js` y abrir `http://127.0.0.1:8080/` (el usuario que se escribe en el login decide quién eres):

| qué | cómo |
|---|---|
| Crear en soles | cualquier usuario: `/vendedor` trae `tipoCambio: 3.45`; elegir PEN. `/pegar` convierte con su regla y responde `moneda`, `tcam` y `totales` |
| Sin tipo de cambio | usuario **`sintc20`**: `tipoCambio: null`, soles desactivada con su aviso, y `/pegar` responde `tipcambio no registrado` |
| Modificar una en soles | **098-00000070** (de hoy, 3.45, `mone` S y `moneitm` D, como las del ERP): agregar un producto y mirar lo que viaja a `/update` |

---

## 5 · Orden de salida

Backend y frontend **el mismo día**, y conviene este orden dentro del día porque no son simétricos:

- **`/pegar` convierte (backend) + pantalla nueva:** cualquiera de los dos primero es inofensivo. El frontend de hoy ya manda
  dólares con `moneda: "S"`; con el backend nuevo queda bien. El frontend nuevo con el backend de hoy sigue grabando
  dólares (el problema que ya existe), no peor.
- **`/update` toma `mone` y `tcam` de la cabecera: tiene que salir junto con el frontend nuevo.** El frontend de hoy manda
  las líneas nuevas **en dólares** a una cotización en soles; con ese cambio del backend quedarían montos en dólares bajo
  una cabecera en soles, la mezcla que quieren evitar.

**Volver atrás:** el frontend es una rama aparte, `git revert -m 1` del merge, sin tocar datos. Lo ya grabado en soles
queda como está.
