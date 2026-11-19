# Despliegue de coti a pedido y revision de cotizacion

Que hay que hacer para subir tres cosas:

- pasar una cotizacion aprobada a pedido (grupos 20 y 25);
- la revision del modulo cotizacion;
- el stock disponible del buscador de productos.

Esta guia es para quien despliega, no para el frontend.

**Backend y frontend salen el mismo dia.** El orden entre los dos no rompe nada:

- si el backend sube primero, `GET /v1/cotizacion` ya trae `pedido`, pero el menu del frontend en produccion
  descarta las acciones que no conoce;
- los rechazos nuevos de crear, modificar y almacen solo los provoca una pantalla que mande datos malos; la
  pantalla actual no los manda.

---

## 1 · Que cambia

| cambio | quien lo ve | rutas | contrato |
|---|---|---|---|
| **Pasar a pedido** | grupos 20 y 25 | `POST /v1/cotizacion/pedido`, `/pedido/opciones`, `/pedido/transportista` | [coti-a-pedido.md](coti-a-pedido.md) §1–8 y §11 |
| Revision de cotizacion: permisos en todas las rutas, validaciones nuevas en crear, modificar y almacen | grupos 20, 25, 32 y 34 | `/v1/cotizacion/pegar`, `/read`, `/readprom`, `/update`, `/almacen` | [coti-a-pedido.md](coti-a-pedido.md) §9 |
| Stock **disponible** = stock − (separado + pedido) | todos los que cotizan | `/v1/producto/buscar`, `/id`, `/encontrado` | [coti-a-pedido.md](coti-a-pedido.md) §9 |

| | |
|---|---|
| Codigo | rama `main` del repositorio `backend-api-v2` (remoto `nuevo`), sobre `d6bbc61`: un commit del stock disponible, uno de cotizacion (la revision y coti a pedido juntos: comparten archivos) y uno de documentos |
| Dependencias | ninguna nueva: `package.json` no cambio. No hace falta `npm install` |
| Variables de entorno | ninguna nueva |
| Base de datos | **una secuencia nueva**, `dbo.seq_pedido_098` (`querys/sp/seq_pedido_098.sql`). Ninguna tabla, ningun procedimiento |

Lo que conviene tener presente:

- **Pasar a pedido escribe en el ERP.**
  - Crea el pedido (`mst01ped` y `dtl01ped`) con los procedimientos del ERP `GrabaMstPedFac` y `GrabaDtlPedFac`.
  - Marca la cotizacion: `flag='1'`, `cdge='32'` y `ndge` igual al pedido.
  - Todo va en una transaccion.
- **Los pedidos son de la serie `098-`**, nueva para pedidos: hasta ahora la intranet solo usaba `098-` en
  cotizaciones. Conviene avisar a quien aprueba pedidos en el ERP que los `098-` vienen de la intranet.
- **El pedido nace sin aprobar** (`apro='0'`) y **no separa stock** (`pedi=0` en las lineas; `prdXX.pedi` no se
  toca). Lo aprueban en el ERP, como cualquier pedido.
- **El estado de la cotizacion no se toca**: el trigger `PromoFlete` de `mst01cot` solo actua cuando cambia el
  estado, asi que no mete el flete de provincia.
- Triggers revisados en bdnava08 el 18/11/2026:
  - **sobre `dtl01ped`**: `Trg_dtl01ped_PreuReal` (solo llena precios de referencia), `tr_dtl01ped_cdes` (no salta:
    `cdes=0`) y `APLICA_PS_MASCOTA` (solo actua sobre la serie `099-`);
  - **sobre `mst01ped`**: los de UPDATE no hacen nada con un pedido sin aprobar y sin lineas de promocion, que es
    como esta cuando se le escriben los datos de despacho;
  - **`trg_mst01ped_logdata`**: esta cifrado y no se pudo leer. El ERP y la web escriben igual sobre `mst01ped`.

---

## 2 · Servidor de prueba (base bdnava08)

bdnava08 **ya tiene la secuencia**: empieza en 1 y no hay pedidos `098-`. Solo falta el codigo.

1. Traer el codigo: en la carpeta del servicio, `git pull` de la rama `main` del repositorio `backend-api-v2`.
2. Comprobar en el `.env` que `DB_NAME` apunta a **bdnava08** y que sigue `CORS_ORIGENES_EXTRA=http://127.0.0.1:8080`.
3. Reiniciar el servicio.
4. Hacer las comprobaciones de la seccion 4.
5. Avisar al frontend para su recorrido ([coti-a-pedido.md](coti-a-pedido.md) §11, punto 4). Ellos mandan los
   numeros de sus cotizaciones de prueba. Nosotros las aprobamos en bdnava08 y, para los casos de plazo, les
   cambiamos la fecha de emision.

Al terminar el recorrido se borran sus pedidos `098-` de prueba, se devuelven sus cotizaciones y se reinicia la
secuencia con `ALTER SEQUENCE dbo.seq_pedido_098 RESTART WITH 1;`.

---

## 3 · Produccion

En este orden, **el mismo dia que el frontend**:

1. **Respaldo** de la base.
2. Correr `querys/sp/seq_pedido_098.sql` en **bdnava01**. Calcula el ultimo pedido `098-` y crea la secuencia en
   el siguiente. En bdnava01 hay **un** pedido `098-`, de prueba y desaprobado: la secuencia arranca en el
   siguiente a ese, y la primera consulta del script dice en cual. Se puede correr mas de una vez. Comprobar: la consulta final devuelve `seq_pedido_098` con su arranque.
3. Subir el codigo de la rama `main` de `backend-api-v2` y reiniciar el servicio. En produccion **no** se define
   `CORS_ORIGENES_EXTRA`.
4. Comprobaciones de la seccion 4.

**Sin la secuencia** la conversion funciona igual: toma el ultimo pedido `098-` mas uno, con la tabla bloqueada
dentro de la transaccion, y deja un aviso en el log (`no existe seq_pedido_098`). Es mas lento con varios vendedores
a la vez. Hay que crearla.

---

## 4 · Comprobaciones despues de subir

| comprobar | cuenta | esperado |
|---|---|---|
| El servicio arranca y dice la base correcta | — | `servicio levantado ... base: bdnava08` (o `bdnava01`) |
| `GET /v1/cotizacion` | grupo 20 o 25 | `data` trae `pedido` al final |
| `GET /v1/cotizacion` | grupo 34 | `data` **sin** `pedido` |
| `POST /v1/cotizacion/pedido/opciones` con una cotizacion propia | grupo 20 | `200` con `convertible`, `motivo`, `antiguedad`, `direcciones` y `tipos_entrega` |
| `POST /v1/cotizacion/pedido/opciones` con una ajena | grupo 20 | `403 coti desconocida` |
| `POST /v1/cotizacion/pedido/transportista` `{"sugerencia":"shalom"}` | grupo 20 | `200`, T0106 |
| `POST /v1/cotizacion/pedido` | grupo 34 | `403 sin permiso` |
| `POST /v1/producto/buscar` | grupo 20 | mismas columnas que antes; el stock es el disponible (puede ser negativo) |
| `POST /v1/cotizacion/read` de una propia | grupo 20 | igual que antes |
| Log del servicio tras la primera conversion | — | **sin** el aviso `seq_pedido_098` |

En bdnava08, ademas, el recorrido del frontend. En produccion **no** se convierte nada para probar: crea un pedido
real. La primera conversion la hace un vendedor; despues se comprueba en el ERP que el pedido `098-` esta sin
aprobar, con las lineas de la cotizacion, y que la cotizacion dice pedido.

---

## 5 · Para volver atras

- **Codigo:** son commits separados.
  - Revertir el de cotizacion quita la accion `pedido` y sus tres rutas, y tambien los permisos y las
    validaciones nuevas de la revision: van en el mismo commit.
  - Revertir el del stock vuelve a mostrar el stock fisico.

  **El frontend no necesita nada**: descarta las acciones que no conoce.
- **Lo ya hecho no se deshace solo.** Los pedidos `098-` creados son pedidos normales del ERP: se aprueban o se
  anulan alli. Al anular un pedido, el ERP devuelve su cotizacion a abierta (`flag 0`, `estado 0`), igual que
  con sus propios pedidos.
- **Base:** la secuencia no molesta al codigo anterior, que no la usa; se puede dejar. Si se quiere quitar:
  `DROP SEQUENCE dbo.seq_pedido_098;`
