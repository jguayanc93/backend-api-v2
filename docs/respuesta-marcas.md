# Grupo 25 — lo construido, lo que lee cada pantalla y lo que viene

Responde a [marcas-grupo25.md](marcas-grupo25.md). Sirve para que los dos lados estemos a
la par: **qué consume el frontend de cada ruta** (y qué no), qué decidimos por nuestra
cuenta, qué dudas quedan, y cuál es el siguiente módulo, **Reportes**, para el que
necesitamos cosas de ustedes antes de empezar.

| | |
|---|---|
| [1 · Estado](#1--estado) | qué está hecho y cómo comprobarlo |
| [2 · Qué lee el frontend de cada ruta](#2--qué-lee-el-frontend-de-cada-ruta) | campos que usamos, campos que no, errores que tratamos aparte |
| [3 · Decisiones nuestras](#3--decisiones-nuestras-que-conviene-que-conozcan) | lo que cambió y por qué |
| [4 · Dudas abiertas](#4--dudas-abiertas) | siete, ordenadas por lo que pesan |
| [5 · Lo que no se construyó](#5--lo-que-no-se-construyó-a-propósito) | la sección 8 de su documento |
| [6 · Siguiente: Reportes](#6--siguiente-módulo-reportes) | contexto, lo que existe hoy y lo que necesitamos |

---

## 1 · Estado

Todo lo de la sección 3 a 7 de su documento está hecho: registro, menú, las siete rutas de
`/v1/marcas` y el aviso `debeAsignar` de cuota.

| pieza | dónde |
|---|---|
| Registro del grupo 25, con marcas opcionales | `autenticador.html`, `js/login/registro.js` |
| Módulo Marcas en el menú | `marcas.html`, `js/marcas/` |
| Especialista: borrador, confirmar, solo lectura | `js/marcas/marcas.js`, `editor.js` |
| Jefatura: panel de la familia | `js/marcas/familia.js` |
| Cuota con `sin marcas del mes` | `js/cuota/avance.js` |

**Cómo comprobarlo sin tocar su backend.** `node dev/servidor.js` levanta el frontend y una
API simulada que reproduce su contrato, con estado (dueños, confirmaciones, familia). Los
usuarios de prueba están en el README: `nuevo25`, `jefatura25`, `confirmado25`…

**El simulacro es una lectura ejecutable de su documento**: está en
[`dev/simulador-marcas.js`](../dev/simulador-marcas.js) y es lo que usan nuestras pruebas.
Si lo contrastan con su implementación, cada diferencia es o un error nuestro o un hueco
de su documento, y en los dos casos queremos saberlo.

**Si cambian una forma de respuesta, nuestras pruebas fallan** (`dev/pruebas/probar-marcas.js`
y `probar-login.js`, 219 comprobaciones). Conviene avisarnos igual: las pruebas cubren lo
que simulamos, no lo que el backend añada.

---

## 2 · Qué lee el frontend de cada ruta

Lo escribimos porque un campo que su documento declara y nosotros ignoramos es un campo
que pueden cambiar o retirar sin romper nada, y uno que leemos es uno que no.

### Reglas generales

- **Decidimos por `status`, mostramos `msg`.** Solo se ramifica por los `status` de la tabla
  de cada ruta; con cualquier otro se enseña el `msg` tal cual llegue. Por eso **el `msg` se
  lee entero por una persona**: conviene que esté escrito para ella.
- **Nunca filtramos ni validamos lo que es regla de negocio.** Qué marcas se ofrecen, a quién
  se pueden dar, si ya confirmó: lo decide el backend. La pantalla solo evita proponer lo que
  sabe que va a rechazarse (por ejemplo, no ofrece «dar» una marca propia).
- **Repintamos pidiendo `GET /v1/marcas` entero** tras cada escritura, como indican. No
  mezclamos la respuesta de la escritura con el estado anterior.
- **Respuestas de `/v1/marcas`:** las leemos como JSON simple. Las de `/login/*` siguen
  llegando doblemente codificadas y las desempaquetamos una vez.

### `GET /v1/login/registro`

| usamos | no usamos |
|---|---|
| `grupo` | — |

**Dependemos del texto exacto de `grupo`.** Lo comparamos con cuatro cadenas escritas en
nuestro catálogo: `VENTAS-EJECUTIVOS`, `VENTAS-JEFES DE PROD`, `VENTAS-JEFES DE ZONA`,
`VENTAS-JEFE DE PRODU`. Un grupo que no esté ahí muestra «tu grupo todavía no tiene registro
disponible». Si renombran uno, el registro de ese grupo deja de funcionar; ver duda 7.

### `POST /v1/login/registro/completado`

**Enviamos:** `diferenciador` en mayúsculas, y `marcas` (lista de códigos como cadenas) **solo
si se eligió alguna**. Sin marcas el campo se omite; no mandamos `[]`.

| usamos de la respuesta | no usamos |
|---|---|
| `correcto` (el tipo con el que quedó, **no** el del formulario) | — |
| `marcas.asignadas[]` → `codmar`, `nombre` (o `abrmar`) | — |
| `marcas.omitidas[]` → `nombre`, `motivo`, `asignadaA` | — |
| `confirmado` | — |

**Si la respuesta no trae ni `marcas` ni `confirmado`, entramos directo al panel**, que es lo
que ocurre en los grupos 20, 34 y 39. Si trae cualquiera de los dos, enseñamos un resultado
del alta (tipo, marcas, omitidas) antes de entrar.

| `status` que tratamos aparte | qué hacemos |
|---|---|
| 409 `usuario ya registrado` | aviso y al panel. No es un error: el primer envío sí llegó |
| 403 `jefatura sin familia` | mostramos `msg`; se queda en el formulario para elegir otro tipo |
| 401 | al inicio de sesión (sin intentar renovar `tip`: aún no hay) |

### `GET /v1/vendedor`

| usamos | no usamos |
|---|---|
| las claves de `data` (una tarjeta por clave), sus valores como subtítulo | — |
| `nombre`, `grupo`, `tipo`, `tipoCambio` | — |

**Una clave de módulo que no conocemos produce una tarjeta que lleva a `/<clave>.html`**, que
si no existe es un 404. Hoy conocemos nueve: `cotizacion`, `pedido`, `factura`, `promocion`,
`cuota`, `listas`, `programador`, `reporte`, `marcas`. **Antes de añadir una clave nueva al
mapa del grupo, avísennos**: sale a producción primero nuestra página.

Para el módulo Marcas decidimos por `data.rol` de `GET /marcas`, **no** por el `tipo` de este
menú, como indican.

### `GET /v1/marcas`

| usamos | no usamos |
|---|---|
| `anno`, `mes` (para «octubre de 2026») | `marcas[].codfam` |
| `rol`, `confirmado`, `confirmadoEn` | `familia.codfam` |
| `marcas[]` → `codmar`, `nombre`, `familia`, `trabajada`, `asignadaPor` | |
| `abrmar` de `marcas[]`, solo si falta `nombre` | |
| `familia.nombre` | |
| `familia.marcas[]` → `codmar`, `abrmar`, `nombre`, `trabajada`, `dueno.{codusu, nombre, soyYo}` | |
| `familia.especialistas[]` → `codusu`, `nombre`, `marcasDeMiFamilia`, `marcasTotal`, `confirmado` | |

Cuatro cosas de las que **sí dependemos**, por si las cambian:

1. **El orden de `familia.marcas`.** No lo reordenamos: pintamos como llega, y su documento
   dice que van primero las trabajadas.
2. **`asignadaPor === "yo"`** como valor literal. Cualquier otro valor lo mostramos como el
   nombre de quien la dio.
3. **`dueno.codusu` y `especialistas[].codusu`** se comparan como cadenas iguales (para
   filtrar por especialista y para no ofrecerle una marca a quien ya la tiene).
4. **`rol` distinto de `JEFATURA` se trata como especialista.** Un tercer valor caería ahí.

Si `familia` es `null` en una jefatura, decimos que no tiene familia cargada y que avise a
sistemas; no rompe nada.

### `GET /v1/marcas/anterior`

| usamos | no usamos |
|---|---|
| `marcas[]` → `codmar`, `abrmar`, `nombre`, `disponible`, `motivo`, `asignadaA` | `anno`, `mes` |

Solo las `disponible: true` entran al borrador. Las demás se enseñan con su `motivo`
(y `asignadaA` entre paréntesis) y no se pueden tomar desde ahí.

### `POST /v1/marcas/disponibles`

**Enviamos** `{ sugerencia }`, **solo con 2 o más caracteres** y esperando 300 ms desde la
última tecla. **Nunca mandamos la sugerencia vacía**, así que el «primeras 50» no lo usamos.

| usamos | no usamos |
|---|---|
| `codmar`, `abrmar`, `nombre`, `familia` | `codfam` |

**Confiamos en que el backend acota por rol** (todas las familias al especialista, solo la
suya a la jefatura): no filtramos nada de nuestro lado. Ver duda 1 sobre el registro.

### `POST /v1/marcas/confirmar`

**Enviamos** `{ marcas: ["0206", "0008"] }`: la primera de las tres formas que aceptan, códigos
como cadenas, sin mes ni año. Puede ir `[]` si ya tiene marcas dadas por la jefatura.

| usamos | no usamos |
|---|---|
| `total`, `omitidas[]` | `confirmado`, `anno`, `mes`, `asignadas`, `yaTenia` |

| `status` que tratamos aparte | qué hacemos |
|---|---|
| 409 `marcas ya confirmadas` | aviso, y repintamos con el estado real (queda en solo lectura) |
| 409 `sin marcas asignables` | **no** queda confirmado: leemos `data.omitidas`, las enseñamos, las **quitamos del borrador** y se puede reintentar |
| 403 `jefatura sin familia`, 400 `marcas invalidas` | mostramos `msg` |

### `POST /v1/marcas/asignar` y `/retirar`

**Enviamos una sola marca por llamada**: `{ codusu, marcas: ["0002"] }`. Es lo que permite la
interfaz (una acción por fila), no una restricción del contrato.

| ruta | usamos | no usamos |
|---|---|---|
| `/asignar` | `asignadas[0].movidaDe`, `yaTenia`, `omitidas[]` | `especialista` |
| `/retirar` | `retiradas`, `omitidas[]` | `especialista` |

Antes de `/asignar` sobre una marca que ya tiene dueño pedimos confirmación, y mostramos el
nombre del dueño actual **que ya trae `GET /marcas`**, no el de la respuesta. Los errores
(`solo jefatura`, `destino invalido`, `destino no especialista`…) se muestran con su `msg`.

### `POST /v1/marcas/estado`

**Enviamos** `{ codmar, trabajada }` con `trabajada` como **booleano estricto**. Para
**incorporar** una marca nueva mandamos `trabajada: true` con un código que no está en la
familia, como describen.

| usamos | no usamos |
|---|---|
| `asignadaEsteMesA`, `incorporada`, `nombre`/`abrmar` | `codmar`, `codfam`, `trabajada` |

`asignadaEsteMesA` lo aceptamos como cadena **o** como objeto con `nombre`; ver duda 4.

### `GET /v1/cuota/mostrar` (sección 7)

Si la respuesta trae `debeAsignar` o `status: "sin marcas del mes"` —**en el primer nivel, sin
`data`**— enseñamos un aviso y un botón a Marcas, en vez de pintar un avance vacío. Es lo
único de cuota que tocamos.

---

## 3 · Decisiones nuestras que conviene que conozcan

### Los tipos del registro salen del frontend

La lista de tipos que ofrece cada grupo está **escrita en nuestro catálogo**, no la devuelve
el backend:

| grupo | tipos que ofrecemos |
|---|---|
| `VENTAS-EJECUTIVOS` (20) | `COBERTURA`, `CARTERA` |
| `VENTAS-JEFES DE PROD` (25) | `ESPECIALISTA`, `JEFATURA` |
| `VENTAS-JEFES DE ZONA` (34) | `ZONA` |
| `VENTAS-JEFE DE PRODU` (39) | `HP`, `CHAKAL` |

Esto cambió respecto a la pantalla anterior, que tenía un `switch` con valores que ustedes
rechazan:

- **«TIO GASEOSA» pasa a llamarse `HP`**, como lo guarda la tabla de diferenciadores.
- **`WEB` deja de ofrecerse**: su documento dice que el grupo 34 solo acepta `ZONA`.
- **`CHAKAL` queda ofrecido**, porque su documento lo lista como válido en el 39. Ver duda 3.

**Si añaden un diferenciador, hay que cambiarlo también aquí**, y nadie nos avisará si se
olvida. Ver duda 7: lo evita que `GET /login/registro` los devuelva.

### El registro no preselecciona tipo

El tipo no se puede cambiar después del alta. Con la primera opción preseleccionada, quien
guarda sin mirar acaba pidiendo `JEFATURA` siendo especialista y tropieza con el 403. Ahora
el desplegable arranca en «Elige tu tipo…» y no deja guardar hasta elegir. Con un solo tipo
(ZONA) queda puesto.

### El borrador vive solo en la pantalla

Como pide su documento. Quien cierra la pestaña a medias pierde la lista, y hoy **no
avisamos al salir**. Es una línea con `beforeunload` si lo prefieren.

### Lo que cambió en el inicio de sesión

- **`no identificado` ya no muestra «usuario y/o contraseña incorrectos».** Antes salía ese
  mensaje un instante y luego se redirigía: a quien acertó su contraseña le decía lo
  contrario de lo que pasaba. Ahora va directo al registro.
- **Va al formulario (`autenticador.html`)**, no a una pantalla intermedia. `registro.html`,
  el menú antiguo que había en medio, se eliminó.
- **El enlace «Crear cuenta» de `index.html` se quitó.** El formulario necesita la sesión que
  se abre ahí, así que el enlace devolvía al login. Quien no figura en la intranet llega al
  alta solo, al entrar.
- **Entrar borra el menú cacheado en el navegador.** Si alguien entraba sin haber cerrado
  sesión, veía un instante el menú y el nombre de la persona anterior.

### Cuando `tip` caduca

Seguimos tratando un 401 como «quizá solo venció `tip`»: llamamos una vez a
`GET /login/identificador` y reintentamos. **Para alguien sin registrar esa llamada devuelve
400 `no identificado`**, que consideramos «sesión terminada» y mandamos al login. Es lo que
queremos; lo decimos para que no les extrañe verla en el registro.

---

## 4 · Dudas abiertas

### 1 · ¿`/marcas/disponibles` funciona antes de estar registrado?

*La que más pesa.* El registro permite elegir marcas, y el buscador es el de `/disponibles`.
Pero a quien se está registrando todavía **no le consta un diferenciador**, y su documento
dice que a la jefatura le filtran por familia y al especialista no.

Hoy asumimos que responde y que, sin saber el rol, devuelve marcas de todas las familias. Si
falla, el error sale **dentro del buscador** y el registro se puede completar igual sin
marcas, que es el camino que su documento ya contempla.

Si no funciona antes del alta, lo más limpio es que nos lo digan y quitamos la búsqueda del
registro: elegir marcas pasaría a ser solo del módulo.

### 2 · Sin marcas en el registro, ¿qué llega?

Con `marcas` omitido, ¿`/login/registro/completado` responde igual
`{ correcto, marcas: { asignadas: [], omitidas: [] }, confirmado: false }`, o solo
`{ correcto }`? Aceptamos las dos, pero **cambia lo que ve un especialista que no eligió
ninguna**: con la primera forma ve una pantalla de resultado; con la segunda entra directo.

### 3 · Grupo 39: ¿`CHAKAL` sigue vigente?

En nuestro catálogo figuraba «fuera de uso». Lo dejamos **ofrecido**: no ofrecer una opción que
aceptan deja sin registrarse a quien de verdad la use, y ofrecer una de más cuesta poco. Si ya
no existe, lo retiramos.

### 4 · `asignadaEsteMesA` en `/marcas/estado`

Su documento lo describe como «si alguien la tiene este mes» y el ejemplo lo muestra en
`null`. Asumimos que es **el nombre**, como `asignadaA` en las omitidas; también aceptamos un
objeto con `nombre`. ¿Cuál es?

### 5 · Una jefatura y sus propias marcas

Ceder una marca propia ya confirmada va a `omitidas`. La pantalla **no ofrece** dar las
propias a un especialista, ni antes ni después de confirmar. ¿Hay algún caso real en que una
jefatura tenga marcas propias sin confirmar y quiera pasarlas? Si lo hay, es un botón más.

### 6 · `GET /marcas` sin diferenciador

¿Qué responde para alguien del grupo 25 que aún no se registró? Hoy mostramos el `msg` del
error y nada más. Es un caso que solo se da si entra a `/marcas.html` a mano sin haber
pasado por el alta, pero queremos saber qué `status` esperar.

### 7 · ¿Pueden devolver los tipos en `GET /login/registro`?

Hoy devuelve solo `{ grupo }` y nosotros traducimos el grupo a los tipos con una tabla propia
(sección 3). Si devolviera también `diferenciadores: ["ESPECIALISTA", "JEFATURA"]`, esa tabla
desaparece, y con ella el riesgo de que el backend acepte un tipo nuevo y la pantalla no lo
ofrezca, o al revés. De paso, la dependencia del texto exacto de `grupo` pasaría a ser solo
informativa. Es una **petición**, no una duda: no bloquea nada.

---

## 5 · Lo que no se construyó a propósito

La sección 8 de su documento dice que no se construyan pantallas sobre esto, y no se hizo:

- Cuota por marca (`/cuota/marcaupdate`, `/cuota/marcamostrar`) y el avance de la familia.
- Reportes por familia. **Ahora es lo siguiente**, ver sección 6.
- Menús distintos por tipo: jefatura y especialista reciben el mismo.

---

## 6 · Siguiente módulo: Reportes

### Contexto

Es una pantalla del grupo 25. La persona ve **las marcas que tiene en el mes** y, para cada
una, elige entre **tres informes**:

| informe | qué quiere ver |
|---|---|
| **Stock** | el stock disponible de esa marca |
| **Tiempo en almacén** | cuánto tiempo lleva ese stock en almacén |
| **Lista de precios** | los precios de los productos de esa marca |

Los tres se pueden **ver en pantalla** y **exportar a Excel**.

Reemplaza a `reporte.html`, que sigue como está: una página antigua que no hemos migrado.

### Lo que existe hoy

La pantalla antigua ya hace parte de esto, y lo contamos aquí porque es de lo que partimos.
Todo lo que sigue sale de leer nuestro código, **no de su backend**: corríjannos lo que
esté mal.

| ruta | qué manda la pantalla antigua | qué espera |
|---|---|---|
| `POST /reporte/marcas` | `{ marcas: "traeme las marcas" }` | una lista **posicional**: de cada entrada lee `[2]` como texto de la marca |
| `POST /reporte/stoc` | `{ marca: "<texto>" }` | un **archivo** (lo guarda como `stoc.xlsx`) |
| `POST /reporte/tiempo` | `{ marca: "<texto>" }` | un archivo (`tiempo.xlsx`) |
| `POST /reporte/precios` | `{ marca: "<texto>" }` | un archivo (`precios.xlsx`) |

Cuatro cosas que no nos sirven para la pantalla nueva:

1. **Manda la marca por su texto, no por `codmar`.** Es el valor de la posición `[2]` que
   devolvió `/reporte/marcas` (no sabemos si es la abreviatura o el nombre). Con las marcas
   partidas —HP tintas `0007`, HP impresoras `0190`, HP cómputo `0160`— un texto no dice cuál.
2. **Solo descarga.** No hay forma de ver el informe en pantalla antes de exportarlo.
3. **Los errores son mudos.** Si el servidor no responde bien, la pantalla escribe en la
   consola y la persona no ve nada.
4. **No está preparada para `sin marcas del mes`** (sección 7 de su documento). Con esa
   forma de respuesta pinta tarjetas sin sentido. No hace falta que hagan nada: la
   reemplazamos.

### Lo que necesitamos decidir

**a · ¿Qué marcas entran?** El planteamiento es «las marcas que tiene confirmadas o
asignadas». Necesitamos la regla exacta:

- ¿Las del especialista son solo las de `GET /marcas` → `marcas`, las que ya tiene?
- ¿Una marca que la jefatura le dio pero **que aún no ha confirmado** cuenta?
- ¿Y las de la jefatura? Su documento (sección 8) dice que verá **toda su familia**; ¿o solo
  las suyas más las de sus especialistas?
- ¿Qué ocurre antes de confirmar nada? ¿La lista está vacía y se explica, o se ven las
  del mes pasado?

**b · Identificar la marca por `codmar`.** Pedimos que las tres rutas acepten `codmar` (cuatro
dígitos) en vez del texto. **No filtraremos nada del lado del cliente**: confiamos en que el
backend compruebe que la marca es de quien pregunta, como hace con `/marcas/asignar`.

**c · Ver y exportar.** Para enseñar el informe en pantalla necesitamos los datos, y para
exportarlo, el archivo. Dos formas posibles, la elige el backend y nos adaptamos:

- **La misma ruta con un parámetro de formato**: `{ codmar, formato: "json" | "xlsx" }`.
- **Rutas separadas** para cada cosa.

Si es JSON, **pedimos filas con nombres, no con posiciones**. Las posiciones nos han dado
fallos silenciosos en cotización, listas y pedido —una moneda leída de la posición
equivocada, sin ningún error visible—, y `/factura/campos` ya devuelve nombres.

**d · Qué lleva cada informe.** Es lo que más nos falta, porque el archivo actual no lo
conocemos. Para cada uno:

| informe | qué necesitamos saber |
|---|---|
| **Stock** | ¿Por almacén (`01` Principal, `08` M&M, `15` Piura, `16` Chorrillos) o total? ¿Qué es «disponible»: físico menos lo comprometido? ¿Con código, part number y descripción? |
| **Tiempo en almacén** | ¿En días? ¿Desde cuándo se cuenta: la última entrada, la primera? ¿Por producto o por lote? ¿Cómo se ordena? |
| **Lista de precios** | ¿Qué precio: el de lista, el de un cliente? ¿Con o sin IGV? ¿En qué moneda, o en las dos? ¿**Sin costos**? Vemos riesgo en exportar a Excel algo que lleve el costo. |

**e · Volumen y tiempo.** ¿Cuántas filas puede tener una marca en el peor caso? Nuestro cliente
corta las peticiones a los **20 segundos**; para estas rutas lo podemos subir, pero si el
informe de una marca grande tarda más conviene saberlo ahora. Para la vista en pantalla,
¿hay paginación, o llega todo?

**f · Errores.** Cuando algo falle, que la respuesta sea el sobre de siempre
`{ status, codigo, msg }` y no un archivo roto: hoy un fallo y un Excel corrupto se ven
igual. Y que el nombre del archivo lo ponga el servidor con `Content-Disposition`; hoy lo
escribimos nosotros a mano.

**g · Permisos.** ¿Solo grupo 25? El menú de `reporte` hoy solo se lo dan a ese grupo. Y si no
hay marcas en el mes, ¿responden con el mismo `sin marcas del mes` + `debeAsignar` que ya
usan en cuota?

### Cómo proponemos avanzar

**No empezar la pantalla hasta tener respuesta a a, b y c.** Migrarla con el contrato actual
—marca por texto, solo descarga— nos obligaría a rehacerla en cuanto cambie, y es justo lo
que no queremos. Con d, e, f y g podemos esperar a que lleguen.

Cuando tengan las respuestas, como con Marcas, escribimos primero el simulacro y las pruebas
sobre su contrato, y la pantalla encima.
