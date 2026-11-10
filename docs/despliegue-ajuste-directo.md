# Despliegue del ajuste directo (grupo 25)

Que hay que hacer para subir el ajuste directo y la asignacion de documentos del grupo 25, y el cambio de regla
del costo 0 en el ajuste de precios. Para quien despliega, no para el frontend.

**Backend y frontend salen el mismo dia.** El orden no rompe nada: el menu del frontend en produccion descarta las
acciones que no conoce, asi que si el backend sube primero el grupo 25 sigue viendo solo «Recibidas» hasta que
suba el frontend.

---

## 1 · Que cambia

| modulo | accion del hub de ajuste | quien la ve | rutas | contrato |
|---|---|---|---|---|
| Ajuste directo | `directo` | grupo 25 (jefatura y especialista) | `GET /v1/ajuste/directo/documentos`, `/documento`, `/vendedores`; `POST /v1/ajuste/directo/aplicar`, `/asignar` | [ajuste-directo.md](ajuste-directo.md) |
| Historial de asignaciones | `asignados` | grupo 25 | `GET /v1/ajuste/asignados` | [ajuste-directo.md](ajuste-directo.md) §8 |
| **Costo 0 = costo desconocido** | — | grupo 25, en «Recibidas» | `/ajuste/solicitud` y `/ajuste/confirmar` | [ajuste-precios.md](ajuste-precios.md) §4 |

| | |
|---|---|
| Codigo | rama `main` del repositorio `backend-api-v2` (remoto `nuevo`), sobre `4fa9ac2`: un commit del costo 0, uno del ajuste directo y uno de documentos |
| Dependencias | ninguna nueva: `package.json` no cambio. No hace falta `npm install` |
| Variables de entorno | ninguna nueva |
| Base de datos | **tres tablas nuevas**: `tbl01_api_ajuste_directo`, `tbl01_api_ajuste_directo_detalle` y `tbl01_api_documento_asignado` (`querys/sp/ajuste_directo.sql`). Nada mas |

Lo que conviene tener presente:

- **El ajuste directo escribe en documentos del ERP**: el precio, el descuento y el costo de las lineas, los totales,
  y borra las promociones (tambien el flete de provincia). Lo mismo que ya hace `confirmar`, pero sobre los
  documentos propios del jefe de marca, **aunque esten aprobados**. Nunca toca `prd0101`.
- **Asignar cambia el `codven_usu`** de la cotizacion o el pedido: pasa a ser del vendedor del grupo 20 elegido.
- **El costo 0 no tiene interruptor.** Desde esta version, una linea cuyo producto tiene costo 0 en su almacen ya
  no se puede ajustar (`409 costo desconocido`). Antes el minimo quedaba en 0 y se aceptaba cualquier precio.
- Se revisaron los triggers del ERP sobre cotizaciones y pedidos (04/11/2026): ninguno cambia el precio ni la
  aprobacion con estas escrituras. `trg_mst01ped_logdata` esta cifrado y no se pudo leer; el ajuste que ya estaba
  en produccion escribe igual sobre `mst01ped` sin problemas.

---

## 2 · Servidor de prueba (base bdnava08)

bdnava08 **ya tiene las tres tablas** y los datos de prueba de noviembre. Solo falta el codigo.

1. Traer el codigo: en la carpeta del servicio, `git pull` de la rama `main` del repositorio `backend-api-v2`.
2. Comprobar en el `.env` que `DB_NAME` apunta a **bdnava08** y que sigue `CORS_ORIGENES_EXTRA=http://127.0.0.1:8080`.
3. Reiniciar el servicio.
4. Hacer las comprobaciones de la seccion 4.
5. Avisar al frontend.

Los documentos de prueba estan respaldados en `C:\Users\PcSis05\Desktop\respaldos_bdnava08\ajuste_pruebas_2026-11-10.json`
(maquina de desarrollo): cuando el frontend termine, se devuelven a como estaban.

---

## 3 · Produccion

En este orden, **el mismo dia que el frontend**:

1. **Respaldo** de la base.
2. Correr `querys/sp/ajuste_directo.sql` en **bdnava01**. Crea las tres tablas y sus indices; se puede correr mas
   de una vez. Comprobar: la consulta final devuelve las 3 tablas y los 3 indices.
3. Subir el codigo de la rama `main` de `backend-api-v2` y reiniciar el servicio. En produccion **no** se define
   `CORS_ORIGENES_EXTRA`.
4. Comprobaciones de la seccion 4.

**No** correr `grupo25_produccion.sql` de nuevo (ademas de las tablas, agrega marcas al catalogo) ni
`datos_prueba_grupo25.sql`.

**Sin las tablas**, el ajuste directo **no funciona**: sus rutas (salvo `vendedores`) y `asignados` responden
`error query`, y aplicar y asignar no cambian nada (todo va en una transaccion). El resto de la intranet, incluida
«Recibidas», sigue igual.

---

## 4 · Comprobaciones despues de subir

| comprobar | cuenta | esperado |
|---|---|---|
| El servicio arranca y dice la base correcta | — | `servicio levantado ... base: bdnava08` (o `bdnava01`) |
| `GET /v1/ajuste` | grupo 25 | `{"accesos":["recibidas","directo","asignados"]}` |
| `GET /v1/ajuste` | grupo 20 | `{"accesos":["enviar","enviadas"]}`, sin cambios |
| `GET /v1/ajuste/directo/documentos?tipo=COT` | grupo 25 | `200`, con `desde`/`hasta` de los ultimos 30 dias y `hayMas` |
| `GET /v1/ajuste/directo/documentos?tipo=COT` | grupo 20 | `403 sin permiso` |
| `GET /v1/ajuste/directo/vendedores` | grupo 25 | `200`, los vendedores activos del grupo 20 |
| `GET /v1/ajuste/asignados` | grupo 25 | `200`, vacio al principio |
| `GET /v1/ajuste/recibidas` | grupo 25 | igual que antes |

En bdnava08, ademas, los casos de [ajuste-directo.md](ajuste-directo.md) §10. En produccion **no** se aplica ni se
asigna nada para probar: escriben en documentos reales.

---

## 5 · Para volver atras

- **Codigo:** son commits separados. Revertir el del ajuste directo quita las acciones `directo` y `asignados` y sus
  rutas; el hub del grupo 25 vuelve a mostrar solo «Recibidas». Revertir el del costo 0 vuelve a aceptar cualquier
  precio en las lineas con costo 0. **El frontend no necesita nada**: descarta las acciones que no conoce.
- **Lo ya hecho no se deshace solo:** los precios aplicados quedan en sus documentos y los documentos asignados
  siguen siendo del vendedor. El registro de cada uno esta en las tablas nuevas (`preu_antes`, `codven_antes`).
- **Base:** las tablas no molestan al codigo anterior, que no las usa; se pueden dejar. Si se quieren quitar:
  `DROP TABLE dbo.tbl01_api_ajuste_directo_detalle, dbo.tbl01_api_ajuste_directo, dbo.tbl01_api_documento_asignado;`
