# Despliegue del grupo 25

Que hay que hacer para subir la rama `grupo25` (marcas, cuota por marca, reportes, cobertura,
ajuste de precios, vendedor del mes y la mejora de auditoria). Para quien despliega, no para el
frontend.

**Backend y frontend salen el mismo dia.** Esta version retira rutas viejas de reportes y de cuota
por marca (responden `404`): si el backend sale antes que las pantallas nuevas, las pantallas
viejas de reportes y de la cuota del especialista dejan de funcionar.

---

## 1 · Que cambia

| | |
|---|---|
| Codigo | rama `grupo25`, 4 commits sobre `eaf82e9` |
| Dependencias | ninguna nueva: `package.json` no cambio. No hace falta `npm install` |
| Variables de entorno | una nueva y **solo en el servidor de prueba**: `CORS_ORIGENES_EXTRA` |
| Base de datos | 7 tablas nuevas (`tbl01_api_*`), catalogo de marcas, jefaturas y el arreglo de la auditoria |

---

## 2 · Servidor de prueba (base bdnava08)

bdnava08 **ya tiene todo**: las 7 tablas, el catalogo, las jefaturas, la auditoria arreglada y los
datos de prueba. Solo falta el codigo.

1. Traer la rama: `git fetch` y `git checkout grupo25` (o `git pull` si ya esta en ella).
2. En el `.env` del servidor de prueba, agregar:
   ```
   CORS_ORIGENES_EXTRA=http://127.0.0.1:8080
   ```
   Es desde donde prueba el frontend. Sin esto el navegador bloquea todas sus llamadas.
3. Comprobar que el `.env` apunta a **bdnava08** (`DB_NAME`).
4. Reiniciar el servicio. Al arrancar escribe `servicio levantado en el puerto ... | base: bdnava08 ...`.
5. Hacer las comprobaciones de la seccion 4.
6. Pasarle al frontend la direccion del servidor (https, bajo `compudiskett.com.pe`) y las claves de
   las cuentas de prueba (seccion 5).

Para que el frontend pruebe el **ajuste de precios** hay que prepararle documentos antes de cada
sesion: el ajuste modifica cotizaciones y pedidos reales de bdnava08.

Si los datos de prueba se borraron o cambio el mes, se recargan con
`querys/sp/datos_prueba_grupo25.sql` (cargan el mes en curso).

---

## 3 · Produccion

En este orden, el mismo dia que el frontend:

1. **Respaldo** de la base.
2. Correr `querys/sp/auditoria_completar.sql` y revisar su comprobacion: `default=1` y `pk=1` en las
   dos tablas; 3 indices en auditoria y 2 en sesiones.
3. Correr `querys/sp/grupo25_produccion.sql`. Crea las 7 tablas, carga el catalogo de marcas y las 5
   jefaturas. Revisar:
   - la consulta 4: deben salir **7 tablas**, y las familias 02, 06, 09, 11 y 12 con su jefatura;
   - la consulta 5: marcas repartidas entre familias. Corregir a mano las que esten en la familia
     equivocada (`update tbl01_api_marcas_estado set codfam='..' where codmar='....'`).
4. **No** correr `datos_prueba_grupo25.sql`: es solo para bdnava08.
5. Subir el codigo de la rama `grupo25` y reiniciar el servicio. En produccion **no** se define
   `CORS_ORIGENES_EXTRA`.
6. Comprobaciones de la seccion 4.
7. Avisar a jefaturas y especialistas que **confirmen sus marcas del mes**: hasta que lo hagan, cuota,
   reportes, cobertura y vendedor del mes les dicen «sin marcas del mes».

Los dos scripts se pueden correr mas de una vez sin duplicar nada.

---

## 4 · Comprobaciones despues de subir

Con una cuenta de cada tipo (en prueba, las de la seccion 5):

| comprobar | cuenta | esperado |
|---|---|---|
| El servicio arranca y dice la base correcta | — | `servicio levantado ... base: bdnava08` (o la de produccion) |
| El menu del grupo 25 | especialista o jefatura | `marcas, cuota, reporte, cobertura, ajuste, vendedormes, cotizacion` |
| El menu del grupo 20 | vendedor | sus modulos de siempre mas `ajuste` |
| `GET /v1/marcas` | especialista | `200` con `rol: ESPECIALISTA` |
| `GET /v1/cuota/mostrar` | especialista | redirige a `/v1/cuota/marcas` |
| `GET /v1/cuota/mostrar` | vendedor de cartera | redirige a `/v1/cuota/cartera`, como antes |
| `GET /v1/reporte/marca` | especialista | `200`, o `sin marcas del mes` si aun no tiene |
| `GET /v1/ajuste` | vendedor / especialista | `["enviar","enviadas"]` / `["recibidas"]` |
| Rutas viejas: `POST /v1/reporte/stoc`, `GET /v1/cuota/especialista` | cualquiera | `404` |
| La auditoria graba | hacer una accion (por ejemplo fijar una meta) | una fila nueva en `tbl_api_auditoria` con `grupo`, `documento` y `detalle` |

---

## 5 · Cuentas de prueba (bdnava08)

Cargadas por `datos_prueba_grupo25.sql` para el mes en curso:

| usuario | caso |
|---|---|
| 071 COSSIO JOANNA | jefatura de la familia 09 (no esta registrada: entra por el registro) |
| 229 SAUÑE MANUEL | especialista confirmado: TDK, EPSON, RICOH, GIGABYTE |
| 233 HUARANCCA SAMUEL | especialista sin confirmar: ADATA |
| 192 OLIVARES ALEXANDER | especialista con AVERY (marca sin productos) |
| 270 RUBIÑOS ANDERSON | especialista sin marcas |
| 094 TRINIDAD PATRICIA | grupo 25 sin registrar |
| 246 GONZALES CRISTOPHER | vendedor del grupo 20 (cartera): envia ajustes |
| 196 | vendedor del grupo 20 con el pedido `009-00774171` (ajuste de pedido) |

---

## 6 · Para volver atras

- **Codigo:** volver al commit `eaf82e9` (antes del grupo 25) y reiniciar.
- **Base:** las tablas nuevas no molestan al codigo anterior, que no las usa; se pueden dejar. El
  arreglo de la auditoria tampoco: solo agrega el DEFAULT, la clave y los indices.
- Las pantallas del frontend tienen que volver tambien a su version anterior.
