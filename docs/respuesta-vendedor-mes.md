# Vendedor del mes (grupo 25) — lo construido y lo que necesitamos aclarar

Responde a [vendedor-mes-grupo25.md](vendedor-mes-grupo25.md) y al menú nuevo de [marcas-grupo25.md](marcas-grupo25.md)
(sección 4, `vendedormes`). **La pantalla está construida y probada contra un simulacro de su documento**
(`dev/simulador-vendedormes.js`), con las mismas marcas y los mismos meses que cuota, reportes y cobertura.

**Nada sale a producción hasta que estén terminados los módulos del grupo 25 y probados en el servidor de
prueba**, y backend y frontend salen el mismo día.

---

## 1 · Cómo lo leímos

**Una sola pantalla, no un hub.** Su documento no define `GET /v1/vendedormes` con accesos, así que la tarjeta
**Vendedor del mes** del menú lleva directamente a `vendedormes.html`, como Reportes, Marcas y Cobertura. En la barra de
abajo de un móvil la etiqueta es **«Vendedores»** (no caben más letras); en el menú lateral y en el título, «Vendedor del mes».

| tema | lo que hace la pantalla |
|---|---|
| **Una tarjeta por marca** | En el orden en que llegan. Dice el código, la familia (y, a la jefatura, de quién es la marca si no es suya), **cuánto vendió el grupo 20 en total y cuántos vendedores fueron** (`total`), y el top |
| **El top** | Una fila por vendedor, del que más vendió al que menos: **puesto**, nombre, **tipo** (Cobertura o Cartera), **venta**, **% del total** (`participacion`), unidades y clientes. Pinta lo que llega: **no suma ni calcula nada**, ni el puesto ni la participación |
| **Menos de 3, o ninguno** | Si la vendieron menos de 3, salen menos filas. Si nadie la vendió, la tarjeta lo dice —*«Nadie del grupo 20 la vendió este mes»*, con su total en cero—: **no se omite**, porque «sin dato» y «nadie» no son lo mismo |
| **Un vendedor sin `tipo`** | Es uno que aún no se registró en la intranet: la fila dice *«Sin registrar en la intranet»*. No inventamos un tipo |
| **La tendencia** | Se lee por su **texto**, y el color solo acompaña: *«▲ Sube (antes puesto 5 · $ 13,509.41)»*, *«▼ Baja (antes puesto 1 · …)»*, *«= Igual (antes puesto 3 · …)»* y *«Nuevo: no la vendió el mes anterior»* (sin inventar un puesto). El puesto de antes puede ser mayor que 3 y lo decimos tal cual |
| **El mes** | Un selector con **el mes en curso y el anterior, nada más** (`?anno=&mes=`). El anterior se pinta como «mes cerrado» y la nota dice que la tendencia compara con el mes anterior **a ese**. Si el mes anterior no tuvo marcas (`sin marcas en ese mes`, que en bdnava08 es lo normal para septiembre) no es un error: dice *«No tenías marcas en septiembre de 2026»* y deja volver. `sin marcas del mes` ofrece ir a **Marcas** |
| **La jefatura** | Un filtro por especialista (**por `dueno.codusu`**): «Todas», «Mías» y uno por cada especialista, con cuántas marcas tiene cada uno. El filtro vuelve a «Todas» si al cambiar de mes ese especialista ya no tiene marcas. El especialista no lo ve |

**Dos avisos en la pantalla, porque alguien va a comparar números:**

- **El total de cada marca no es el avance de la cuota.** Lo dice su sección 1 (EPSON: 35 835,86 de cuota y 35 670,42 aquí) y
  lo dice la pantalla: *«El total de cada marca es solo lo que vendió el grupo 20: no es el avance de la cuota, que mide la marca en
  toda la empresa»*.
- **Todo en dólares y sin IGV**, con lo mismo que cuenta como venta en la cuota.

---

## 2 · Lo que necesitamos aclarar

### 1 · El desempate

Si dos vendedores venden exactamente lo mismo de una marca, ¿quién va primero? Lo preguntamos porque el top es lo que la gente
se va a mirar entre sí: queremos decirlo si hay una regla (por ejemplo, el de más clientes o el que vendió primero), y no
quedarnos mudos cuando dos puestos se inviertan entre dos lecturas.

### 2 · Ventas netas en cero o negativas

Las notas de crédito restan. Un vendedor cuyas notas de crédito de una marca superen sus ventas del mes tendría una **venta
negativa**: ¿entra en `total.vendedores`, en `total.venta` y en el top, o solo cuentan los de venta mayor que 0? Si pudiera llegar,
la pantalla pintaría un importe y una participación negativos, y preferimos saber si es posible antes de decidir cómo decirlo.

### Dos sugerencias, opcionales

- **Desde qué día llegan los datos.** En bdnava08 las facturas llegan hasta el 09/10 y el top de octubre es «de esos días»; en
  producción, a principios de mes, el top son los dos o tres primeros días. Un campo con **la fecha hasta la que hay ventas**
  (`hasta`, `AAAA-MM-DD`) nos permitiría decir *«con ventas hasta el 09/10/2026»* y evitar que alguien lea el top de un mes
  empezado como si fuera el del mes completo.
- **Más de tres.** `total.vendedores` dice que fueron 16 y el top enseña 3. Si fuera útil ver más, un parámetro (`?top=10`) lo
  montaría igual; si no, no hacemos nada.

---

## 3 · Para recorrerlo contra bdnava08

Con la dirección del servidor de prueba y las claves de las cuentas (las pasa quien coordina), la pantalla se apunta a ese
servidor sin tocar código, como en [respuesta-cuota-marcas.md](respuesta-cuota-marcas.md). **Es solo lectura**: no hay nada
que preparar.

| caso | qué comprobamos |
|---|---|
| **Especialista 229** (en octubre: EPSON, GIGABYTE y RICOH con top; TDK con el top vacío) | las tres tarjetas con su top, y la de TDK con *«Nadie del grupo 20 la vendió este mes»* |
| **Jefatura 071** (ACER con 1 vendedor) | el filtro por especialista, y una marca con **una sola fila** |
| **Sin marcas, 270** | `sin marcas del mes`, con el camino a Marcas |
| **Septiembre** | `?anno=2026&mes=9`: en bdnava08 responde `sin marcas en ese mes` y la pantalla lo dice sin error |
| **`?anno=2026&mes=8`** y **`?anno=2026`** | `400 mes no disponible` |
| **Contra la cuota** | que `total.venta` **no** coincida con el avance de la cuota de la misma marca, y que la diferencia sea la venta de los vendedores de otros grupos (EPSON: 35 835,86 frente a 35 670,42) |
| Un vendedor **sin registrar** | que `tipo` llegue `null` y la fila diga *«Sin registrar en la intranet»* |
| Un grupo 20 | `403 sin permiso` |
| **El menú** | que `vendedormes` llegue en el menú del grupo 25 (jefatura y especialista) y no en el del 20 |

---

## 4 · Cierre

**Damos el módulo por cerrado cuando:**

- [x] la pantalla está construida y probada con el simulacro
- [ ] las dos preguntas de la sección 2 están respondidas
- [ ] tenemos la dirección del servidor de prueba y las claves
- [ ] los casos de la sección 3 están recorridos contra bdnava08
