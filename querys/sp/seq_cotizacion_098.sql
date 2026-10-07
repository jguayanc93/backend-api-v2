/*
    seq_cotizacion_098  -  el correlativo de la serie 098-, que es la que crea /cotizacion/pegar

    POR QUE
    -------
    El correlativo se calculaba asi:

        select top 1 RIGHT(ndocu,8) from mst01cot where LEFT(ndocu,3)='098'
        order by RIGHT(ndocu,8) desc        -- y luego +1 en JavaScript

    Dos problemas:

    1) CARRERA. Entre leer el maximo y grabar la cotizacion no hay nada que impida que
       otra peticion lea el mismo maximo. Las dos calculan el mismo numero. No se
       corrompen datos -mst01cot tiene PK unica en (cdocu,ndocu)- pero la segunda INSERT
       falla con violacion de clave y el vendedor pierde la cotizacion con un 500.

    2) COSTE. RIGHT() y LEFT() sobre la columna impiden usar indice, asi que recorre las
       850 000 filas de mst01cot en CADA creacion: 132 ms medidos.

    Una SEQUENCE resuelve las dos: entrega el numero de forma atomica, sin bloqueos y sin
    tocar la tabla.

    SEGURO DE USAR porque la serie 098- la crea UNICAMENTE /cotizacion/pegar. Las otras
    series (009-, 099-, 020-) las lleva el ERP y no se tocan.

    ANTES DE EJECUTAR: el START WITH debe ser el siguiente al ultimo que exista. El SELECT
    de abajo lo calcula; revisar que coincida con lo esperado antes de crear la secuencia.
*/

----1) cual es el ultimo numero usado (ejecutar y revisar)
SELECT ISNULL(MAX(CAST(RIGHT(ndocu,8) AS int)),0)     AS ultimo_usado,
       ISNULL(MAX(CAST(RIGHT(ndocu,8) AS int)),0) + 1 AS deberia_arrancar_en
FROM mst01cot WHERE LEFT(ndocu,3)='098';

----2) la secuencia. Ajustar START WITH al valor de "deberia_arrancar_en".
CREATE SEQUENCE dbo.seq_cotizacion_098
    AS int
    START WITH 38
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 99999999
    NO CYCLE
    CACHE 10;

----3) comprobacion: no consume numero, solo informa
SELECT CAST(current_value AS int) AS siguiente
FROM sys.sequences WHERE name='seq_cotizacion_098';

/*
    SI HAY QUE REAJUSTARLA alguna vez (por ejemplo tras cargar datos a mano):

        ALTER SEQUENCE dbo.seq_cotizacion_098 RESTART WITH <nuevo valor>;

    Y si se quiere volver atras del todo:

        DROP SEQUENCE dbo.seq_cotizacion_098;

    El backend vuelve al calculo anterior si la secuencia no existe, asi que borrarla no
    rompe nada: solo se pierde la proteccion contra la carrera.
*/
