# Despliegue del grupo 20 y la actualizacion del grupo 34

Que hay que hacer para subir lo que se agrego despues de la cotizacion en soles: la lista de precios,
las promociones vigentes y ¿A quien vender hoy? del grupo 20, mas los clientes de zona del grupo 34 con su
regla de CARTERA. Para quien despliega, no para el frontend.

**Backend y frontend salen el mismo dia, y el frontend primero.** Esta version agrega tres claves al menu de
**todos** los vendedores del grupo 20 (`listaprecios`, `promovigentes` y `quienvender`) y una al del 126 (`clientes`).
`listaprecios` se encendio el 30/10/2026, cuando el frontend publico su pantalla (`listaprecios.html`). Una clave
que el frontend no conoce se pinta como una entrada generica que lleva a una pagina que no existe (404). Si el
frontend sube primero, no se ve nada hasta que el backend mande las claves.

---

## 1 · Que cambia

| modulo | clave del menu | quien la ve | ruta | contrato |
|---|---|---|---|---|
| Clientes de zona | `clientes` | el 126 (grupo 34) | `GET /v1/zona/cartera`, `GET /v1/zona/cobertura` | [zona-grupo34.md](zona-grupo34.md) |
| **Regla de CARTERA** y tercer mes | — | **todos los vendedores de cartera** y el 126 | avance, probabilidad y la cuota propia | [zona-grupo34.md](zona-grupo34.md) §2 y §10 |
| Lista de precios | `listaprecios` | grupo 20 | `POST /v1/reporte/listaprecios` | [listaprecios-grupo20.md](listaprecios-grupo20.md) |
| Promociones vigentes | `promovigentes` | grupo 20 | `GET /v1/promocion/vigentes` y `/vigentes/:idprom` | [promovigentes-grupo20.md](promovigentes-grupo20.md) |
| **Fechas en el motor de cotizacion** | — | **todos los que cotizan** | `/promocion/recolector`, `/revisar`, `/detalle`, `/mostrar` y `/acoplar` | [promovigentes-grupo20.md](promovigentes-grupo20.md) §4 |
| ¿A quien vender hoy? | `quienvender` | grupo 20 | `GET /v1/quienvender` | [quienvender-grupo20.md](quienvender-grupo20.md) |

| | |
|---|---|
| Codigo | rama `main` del repositorio `backend-api-v2` (remoto `nuevo`), sobre `5c2ccb3`: un commit del grupo 34 y uno del grupo 20, mas los de documentos |
| Dependencias | ninguna nueva: `package.json` no cambio. No hace falta `npm install` |
| Variables de entorno | ninguna nueva |
| Base de datos | **una tabla nueva**: `tbl_api_quienvender` (`querys/sp/quienvender.sql`). Nada mas |

Dos cambios **no tienen clave de menu**, y por eso conviene tenerlos presentes:

- **La regla de CARTERA no tiene interruptor.** Cambia las cifras que ya ven **todos los vendedores de cartera** en
  su avance, su probabilidad y su propia cuota. Conviene que el aviso a los vendedores salga **el mismo dia**.
- **El motor de cotizacion ya no aplica promociones vencidas.** Hoy no cambia nada en la base principal: sus 43
  promociones encendidas estan vigentes. Evita que una que se olvide apagar se siga aplicando.

---

## 2 · Servidor de prueba (base bdnava08)

bdnava08 **ya tiene la tabla** `tbl_api_quienvender` (vacia). Solo falta el codigo.

1. Traer el codigo: en la carpeta del servicio, `git pull` de la rama `main` del repositorio `backend-api-v2`.
2. Comprobar en el `.env` que `DB_NAME` apunta a **bdnava08** y que sigue la variable
   `CORS_ORIGENES_EXTRA=http://127.0.0.1:8080` (desde ahi prueba el frontend).
3. Reiniciar el servicio. Al arrancar escribe `servicio levantado en el puerto ... | base: bdnava08 ...`.
4. Hacer las comprobaciones de la seccion 4.
5. Avisar al frontend. Las claves de las cuentas de prueba no van en los documentos.

La base de prueba va **atrasada** respecto a produccion: sus facturas llegan al 09/10 y las cotizaciones al 23/10.
Tiene 25 promociones encendidas, de las que 5 estan vencidas; produccion tiene 43 y ninguna vencida.

---

## 3 · Produccion

En este orden, **el mismo dia que el frontend**:

1. **El frontend sube primero.**
2. **Respaldo** de la base.
3. Correr `querys/sp/quienvender.sql` en **bdnava01**. Crea la tabla y sus dos indices; se puede correr mas de una
   vez, y si la tabla ya existe no hace nada. Comprobar: la ultima consulta devuelve `tbl_api_quienvender | 0`.
4. Subir el codigo de la rama `main` de `backend-api-v2` y reiniciar el servicio. En produccion **no** se define
   `CORS_ORIGENES_EXTRA`.
5. Comprobaciones de la seccion 4.
6. Avisar a los vendedores de cartera que sus cifras de avance, probabilidad y cuota pueden cambiar.

**No hace falta ningun otro script.** Se comprobo en solo lectura el 29/10/2026 que la base principal ya tiene las
tablas del grupo 25 (`tbl01_api_jefatura_familia`, `tbl01_api_marcas_*`, `tbl01_api_ajuste_*`) y la auditoria con
su `DEFAULT` en la fecha. **No** correr `datos_prueba_grupo25.sql`.

Sin la tabla, ¿A quien vender hoy? **funciona igual**: el vendedor recibe sus sugerencias, pero sin memoria (el mismo
cliente puede repetirse de un dia a otro) y sin historial. El fallo queda en el log del servidor.

---

## 4 · Comprobaciones despues de subir

Con una cuenta de cada tipo (en prueba, las de la seccion 5):

| comprobar | cuenta | esperado |
|---|---|---|
| El servicio arranca y dice la base correcta | — | `servicio levantado ... base: bdnava08` (o `bdnava01`) |
| El menu del grupo 20 | vendedor | sus modulos de siempre mas `listaprecios`, `promovigentes` y `quienvender` |
| El menu del grupo 34 | el 126 | `cotizacion, avance, probabilidad, clientes` |
| `GET /v1/promocion/vigentes` | vendedor | `200`; en produccion unas 40 promociones, en bdnava08 20 |
| `GET /v1/promocion/vigentes/abc` | vendedor | `404 promocion no vigente` |
| `GET /v1/promocion/vigentes` y `GET /v1/quienvender` | el 126 o un usuario del grupo 25 | `403 sin permiso` |
| `GET /v1/quienvender` | vendedor de cartera | `200`, 3 sugeridos: 2 `REPONER` y 1 `LLAMAR`, con la `fecha` de hoy |
| `GET /v1/quienvender` otra vez | el mismo vendedor | las mismas tarjetas, al instante |
| La tabla graba | — | `select * from tbl_api_quienvender where fecha = cast(getdate() as date)`: 3 filas de ese vendedor |
| `POST /v1/reporte/listaprecios` | vendedor | `200` con las filas de las 8 familias; sin costo ni stock |
| La descarga queda auditada | — | una fila nueva en `tbl_api_auditoria` con la accion de la lista de precios |
| `GET /v1/zona/cartera?codusu=...` y `/cobertura` | el 126 | `200`; los casos estan en la seccion 6 de [zona-grupo34.md](zona-grupo34.md) |
| `POST /v1/promocion/revisar` con un producto en promocion vigente | vendedor | sigue ofreciendola |

---

## 5 · Cuentas de prueba (bdnava08)

| usuario / vendedor | caso |
|---|---|
| V0313 (usuario 371) | cartera: 2 `REPONER` y 1 `LLAMAR` |
| V0278 (usuario 196) | cobertura: 2 `REPONER` y 1 `LLAMAR` |
| V0353 | cobertura sin clientes de `REPONER` ni de `LLAMAR`, con clientes asignados sin compras: 3 `SIN_COMPRAS` |
| V0360 | cobertura sin clientes de `REPONER` ni de `LLAMAR`: 3 `LIBRE` |
| 126 | jefe de zona: entra a `clientes`; recibe `403` en promociones vigentes y en «hoy» |
| un usuario del grupo 25 | recibe `403 sin permiso` en las dos |

Cada vendedor recibe sus 3 clientes **una vez por dia**: para volver a ver el armado de uno, se borran sus filas del
dia en `tbl_api_quienvender` (solo en bdnava08).

---

## 6 · Para volver atras

- **Codigo:** el grupo 34 y el grupo 20 son commits separados, asi que se puede revertir uno sin el otro con
  `git revert`, o volver al commit `5c2ccb3` y reiniciar. **El frontend no necesita nada**: sin las claves no hay
  entradas, y sin los campos nuevos las pantallas no muestran nada de mas.
- **Revertir el grupo 34** devuelve los numeros de los vendedores de cartera a los de antes. La regla de CARTERA
  no se puede revertir sola, porque es la misma en el avance, la probabilidad, la cuota y los clientes.
- **Revertir el grupo 20** quita las claves, las rutas nuevas y el cambio de fechas del motor de cotizacion.
- **Quitar solo una clave** del menu (una linea de `funciones/modulos.js`) oculta la entrada, pero **la ruta sigue
  respondiendo al grupo 20** si alguien escribe la direccion. Es solo lectura, salvo que abrir `quienvender` graba
  las filas del dia. El cambio de fechas del motor no depende del menu.
- **Base:** la tabla `tbl_api_quienvender` no molesta al codigo anterior, que no la usa; se puede dejar. Si se quiere
  quitar: `DROP TABLE dbo.tbl_api_quienvender;`
