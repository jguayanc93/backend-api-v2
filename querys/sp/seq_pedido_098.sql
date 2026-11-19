/*
    seq_pedido_098  -  el correlativo de los pedidos de la serie 098-, los que crea la
    intranet al pasar una cotizacion a pedido.

    Mismo motivo que seq_cotizacion_098: con una SEQUENCE el numero se entrega de forma
    atomica, asi dos conversiones a la vez no calculan el mismo numero. Sin ella, la
    segunda chocaria con la clave primaria de mst01ped y el vendedor veria un error.

    La serie 098- de pedidos es solo de la intranet (decidido el 18/11/2026). En bdnava01
    ya existe UN pedido 098, de prueba y desaprobado: el arranque se calcula desde lo que
    haya, asi que la secuencia sigue despues de ese.

    Se puede correr mas de una vez: si la secuencia ya existe no la toca.
    Es independiente de seq_cotizacion_098: cotizaciones y pedidos llevan cada uno su propia
    numeracion, como en el ERP (009- en las dos tablas, con contadores distintos).
*/

SET NOCOUNT ON;

----1) cual es el ultimo pedido 098 (informativo)
SELECT ISNULL(MAX(CAST(RIGHT(ndocu,8) AS int)),0)     AS ultimo_usado,
       ISNULL(MAX(CAST(RIGHT(ndocu,8) AS int)),0) + 1 AS arrancara_en
FROM mst01ped WHERE LEFT(ndocu,3)='098';

----2) la secuencia, arrancando en el siguiente al ultimo que exista
IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name='seq_pedido_098' AND schema_id=SCHEMA_ID('dbo'))
BEGIN
    DECLARE @inicio int = (SELECT ISNULL(MAX(CAST(RIGHT(ndocu,8) AS int)),0) + 1
                           FROM mst01ped WHERE LEFT(ndocu,3)='098');
    DECLARE @sql nvarchar(400) =
        N'CREATE SEQUENCE dbo.seq_pedido_098 AS int START WITH ' + CAST(@inicio AS nvarchar(12)) +
        N' INCREMENT BY 1 MINVALUE 1 MAXVALUE 99999999 NO CYCLE CACHE 10;';
    EXEC sp_executesql @sql;
    PRINT 'seq_pedido_098 creada, arranca en ' + CAST(@inicio AS varchar(12));
END
ELSE
    PRINT 'seq_pedido_098 ya existia: no se toco';

----3) comprobacion: no consume numero, solo informa
SELECT name, CAST(start_value AS int) AS arranque, CAST(current_value AS int) AS actual
FROM sys.sequences WHERE name='seq_pedido_098';

/*
    Reajustar (por ejemplo tras cargar pedidos 098 a mano):
        ALTER SEQUENCE dbo.seq_pedido_098 RESTART WITH <ultimo 098 + 1>;
    Quitarla:
        DROP SEQUENCE dbo.seq_pedido_098;
*/
