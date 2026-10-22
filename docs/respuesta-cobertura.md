# Cobertura de clientes por marca (grupo 25) — lo construido y lo que necesitamos aclarar

Responde a [cobertura-grupo25.md](cobertura-grupo25.md). **La pantalla está construida y probada contra un
simulacro de su documento** (`dev/simulador-cobertura.js`), con las mismas marcas y los mismos meses que cuota y
reportes. **No tiene nada que ver con la cobertura del grupo 20** (`/cuota/cobertura`): no la hemos tocado.

**Nada sale a producción hasta que estén terminados los módulos del grupo 25 y probados en el servidor de
prueba**, y backend y frontend salen el mismo día.

---

## 1 · Cómo la leímos

**Una sola pantalla, no un hub.** Su documento no define `GET /v1/cobertura` con accesos, así que la tarjeta
**Cobertura** del menú lleva directamente a `cobertura.html`, como Reportes y Marcas. Tiene dos vistas en la misma página.

| vista | lo que hace |
|---|---|
| **Las marcas del mes** | Una tarjeta por marca, en el orden que llega (por nombre): su código, nombre, familia, la **venta**, los **clientes** y las **unidades**. Arriba, el resumen (`total`): clientes, unidades y venta. **Una marca sin ventas sale con ceros y atenuada**, no se omite |
| **El mes** | Un selector con **el mes en curso y los dos anteriores** (`?anno=&mes=`). Un mes anterior se pinta como «mes cerrado», con las marcas y los dueños de entonces. `sin marcas en ese mes` no es un error: dice *«No tenías marcas en agosto de 2026»* y deja cambiar de mes. `sin marcas del mes` ofrece ir a **Marcas** |
| **La jefatura** | Además, un filtro por especialista (**por `dueno.codusu`**): «Todas», «Mías» y uno por cada especialista, con cuántas marcas tiene cada uno. A la jefatura la segunda línea de una marca ajena le dice de quién es. El especialista no ve el filtro: todas le salen suyas |
| **Los clientes de una marca** | Al tocar una marca se pide `GET /cobertura/clientes?codmar=` con el mes que se estaba mirando. Muestra la marca, su dueño y sus números (`total`), y los clientes **en el orden que llega** (por venta, de mayor a menor): nombre, RUC, unidades, comprobantes, última compra e importe. Con buscador por nombre o RUC |

**Nada se calcula en pantalla.** Los totales, el orden y el número de clientes salen de ustedes. En particular
**`total.clientes` de la lista de marcas son clientes distintos**: la pantalla lo dice (*«uno que compró dos marcas
cuenta una sola vez, por eso no es la suma de los clientes de cada marca»*) para que nadie sume las filas y piense
que hay un error.

**Quien solo devolvió.** Lo que dice su sección 1: sale en la lista con unidades y venta negativas y **no cuenta** en
`clientes`. Lo decimos en la propia fila (*«no cuenta: solo devoluciones»*, con las unidades en rojo) y con una nota
sobre la lista, para que el número de arriba no extrañe frente a las filas.

**Volumen.** Con una marca de 126 clientes (EPSON en octubre) pintamos los **100 primeros** —los que más compraron— y un
botón **«Mostrar los N restantes»**. El buscador mira todos, no solo los pintados.

---

## 2 · Lo que necesitamos aclarar

### 1 · `/clientes` de quien no tiene marcas

Su sección 5 pone `sin marcas del mes` «en el primer nivel». En `/clientes` hay un `codmar` de por medio, y en
reportes la respuesta con un `codmar` en la mano es `403 marca no disponible`, no `sin marcas del mes`. **Asumimos lo
mismo aquí**: si alguien sin marcas (o sin esa marca ese mes) pide `/clientes?codmar=…`, ¿responde `403 marca no
disponible`? Es lo que hace el simulacro, y la pantalla ya lo trata: lo dice con su `msg` y vuelve a pedir la lista,
que estaba desfasada.

### 2 · `unidades` en cero

Su sección 4 dice que `unidades` *«puede ser 0 o negativo»*. **Leemos el cero como «compró y devolvió todo»**, y la
fila dice *«no cuenta: devolvió todo lo comprado»*. ¿Es así, o puede ser cero por otra razón (por ejemplo, solo
comprobantes sin unidades)?

### 3 · ¿Hay tope en la lista de clientes?

Pedimos todos los de la marca de una vez. ¿Hay un tope de filas en `/clientes`, o una marca con mil clientes los trae
todos? Lo preguntamos para decidir si el botón «Mostrar los N restantes» basta o conviene pedir por páginas.

### Sugerencia, opcional

Reportes ya se puede exportar a Excel. Si cobertura también lo va a ofrecer (los clientes de una marca en el mes), lo
montamos igual que allí; si no, no hacemos nada.

---

## 3 · Para recorrerlo contra bdnava08

Con la dirección del servidor de prueba y las claves de las cuentas (las pasa quien coordina), la pantalla se
apunta a ese servidor sin tocar código, como en [respuesta-cuota-marcas.md](respuesta-cuota-marcas.md). **Es solo
lectura**: no hay nada que preparar.

| caso | qué comprobamos |
|---|---|
| **Especialista 229** (EPSON con 126 clientes en octubre; TDK con 0) | la marca grande con su botón de «restantes»; TDK con ceros; que `total.clientes` **no** sea la suma de las filas |
| **Jefatura 071** (ACER con 2 clientes) | el filtro por especialista y la segunda línea de las marcas ajenas |
| **Sin marcas, 270** | `sin marcas del mes`, con el camino a Marcas |
| **Septiembre** y **hace dos meses** | `?anno=2026&mes=9` con las marcas de entonces; `sin marcas en ese mes` en el de hace dos meses |
| Un cliente que **solo devolvió** en el mes | que sale con negativos y que `total.clientes` no lo cuenta |
| **Contra la cuota** | que la `venta` de una marca aquí sea la `avance.venta` de la misma marca y el mismo mes en `/cuota/marcas` (su sección 1 dice que usan la misma regla) |
| `/clientes` sin `codmar`, con uno de 3 dígitos, o de una marca ajena | `400 codmar invalido` y `403 marca no disponible` |
| Un usuario del grupo 20 | `403 sin permiso` |

---

## 4 · Cierre

**Damos el módulo por cerrado cuando:**

- [x] la pantalla está construida y probada con el simulacro
- [ ] las tres preguntas de la sección 2 están respondidas
- [ ] tenemos la dirección del servidor de prueba y las claves
- [ ] los casos de la sección 3 están recorridos contra bdnava08
