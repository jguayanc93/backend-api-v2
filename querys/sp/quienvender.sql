/*
    ¿A quien vender hoy?  -  una tabla

      tbl_api_quienvender   los clientes que se le sugirieron a cada vendedor del grupo 20 cada dia,
                            y, pasado el dia, si ese dia cotizo, pidio o facturo a alguno de ellos

    Es una tabla NUEVA de la intranet. No toca nada del ERP.

    Para que sirve
    --------------
    1. Que el vendedor reciba las mismas sugerencias todo el dia: la primera vez que abre el modulo
       en el dia se calculan y se graban; las siguientes veces se leen de aqui. No hay boton de
       cambiar: si no le sirvieron, espera al dia siguiente.
    2. Que las sugerencias roten: el cliente que hace mas tiempo que no se sugiere sale primero. La
       rotacion se lee de esta misma tabla (ultima fecha en que se sugirio cada cliente).
    3. Un historial de uso, aparte de la auditoria: saber si lo sugerido se convierte en cotizacion,
       pedido o factura. Se consulta con SELECT; no tiene pantalla.

    Las marcas cotizo / pidio / facturo
    -----------------------------------
    Valen solo para el MISMO dia de la sugerencia (cotizacion en mst01cot tipo 31, pedido en mst01ped
    tipo 32, factura o boleta en mst01fac tipos 01 y 03; hechos por el vendedor, al cliente, sin
    anular). Se llenan cuando el vendedor abre el modulo en un dia posterior y le cierra los dias
    anteriores: no hay proceso nocturno. Hasta entonces quedan en NULL, que significa "el dia aun no
    se cierra" y es distinto de 0 ("no hizo nada"). El dia de hoy nunca esta cerrado.

    Un vendedor que deja de abrir el modulo deja sus ultimos dias sin cerrar; es lo esperado.

    La fecha y la hora las escribe el codigo, no la tabla: en bdnava08 las tablas de auditoria quedaron
    sin DEFAULT en la fecha y fallaban en silencio. Por eso aqui tampoco se depende de un DEFAULT.

    CRECIMIENTO ESPERADO
    --------------------
    Hasta 3 filas por vendedor y por dia habil, con unos 20 vendedores: unas 60 filas al dia. Sin
    trabajo de mantenimiento durante años.
*/

----------------------------------------------------------------------------------------
---- 1) La tabla
----------------------------------------------------------------------------------------
----Se puede correr mas de una vez: si la tabla ya existe, no hace nada (ni la toca ni la vacia).
IF OBJECT_ID('dbo.tbl_api_quienvender','U') IS NULL
BEGIN
CREATE TABLE dbo.tbl_api_quienvender(
    id            bigint IDENTITY(1,1) NOT NULL,
    fecha         date          NOT NULL,   -- el dia de la sugerencia, segun el servidor
    codven        varchar(12)   NOT NULL,
    codusu        varchar(12)   NULL,
    puesto        tinyint       NOT NULL,   -- 1 y 2: los de reponer; 3: el de llamar
    tipo          varchar(12)   NOT NULL,   -- REPONER, LLAMAR, REACTIVAR, SIN_COMPRAS, LIBRE
    codcli        varchar(12)   NOT NULL,
    cliente       varchar(80)   NULL,       -- el nombre cuando se sugirio
    valor         decimal(14,2) NULL,       -- dolares: lo vencido (REPONER), la media mensual (LLAMAR)
    detalle       nvarchar(max) NULL,       -- lo que se le mostro al vendedor, en JSON
    creado        datetime      NOT NULL,

    ----el resultado del dia; NULL hasta que se cierra
    cotizo        bit           NULL,
    pidio         bit           NULL,
    facturo       bit           NULL,
    cerrado       datetime      NULL,

    CONSTRAINT PK_tbl_api_quienvender PRIMARY KEY CLUSTERED (id),
    ----una sola tanda por vendedor y por dia: si dos peticiones llegan a la vez, la segunda choca aqui
    CONSTRAINT UQ_quienvender_dia UNIQUE (fecha, codven, puesto)
);

----la rotacion: cuando fue la ultima vez que se le sugirio cada cliente a este vendedor
CREATE INDEX IX_quienvender_cliente ON dbo.tbl_api_quienvender (codven, codcli, fecha DESC);
----los dias por cerrar de un vendedor
CREATE INDEX IX_quienvender_abiertos ON dbo.tbl_api_quienvender (codven, cerrado, fecha);
END

----------------------------------------------------------------------------------------
---- 2) Comprobacion
----------------------------------------------------------------------------------------
SELECT 'tbl_api_quienvender' AS tabla, COUNT(*) AS filas FROM dbo.tbl_api_quienvender;

/*
    PARA DESHACER:

        DROP TABLE dbo.tbl_api_quienvender;

    El backend funciona igual si la tabla no existe: el vendedor recibe sus sugerencias de todas
    formas, pero sin memoria (el mismo cliente puede repetirse) y sin historial. El fallo queda en el
    log del servidor.

    CONSULTAS UTILES
    ----------------
    -- cuantas sugerencias terminaron en algo, por vendedor, en el mes
    SELECT codven, tipo, COUNT(*) sugeridos,
           SUM(CAST(cotizo AS int)) cotizaron, SUM(CAST(pidio AS int)) pidieron, SUM(CAST(facturo AS int)) facturaron
    FROM dbo.tbl_api_quienvender
    WHERE cerrado IS NOT NULL AND fecha >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
    GROUP BY codven, tipo ORDER BY codven, tipo;
*/
