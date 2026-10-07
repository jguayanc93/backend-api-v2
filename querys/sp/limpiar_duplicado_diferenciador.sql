/*
    tbl_api_vendedores_diferenciador  -  quitar filas duplicadas

    La tabla no tiene clave primaria, asi que puede acumular filas identicas. Hoy hay una
    sola: V0206 (GONZALES CRISTOPHER, codusu 246, CARTERA, grupo 20) aparece dos veces, con
    todos los campos iguales.

    Mientras las dos filas digan lo mismo no hace daño: /v1/login/identificador lee
    "select diferenciador ... where codusu=@vendedor" y se queda con la primera. El riesgo
    aparece si algun dia se editan por separado y quedan con diferenciadores distintos: ese
    vendedor entraria a una pantalla u otra segun el orden que devuelva SQL Server, que no
    esta garantizado.

    Se conserva una fila de cada combinacion y se borran las sobrantes. Como las filas son
    identicas, no se pierde informacion.

    Verificar antes de ejecutar: el SELECT de abajo debe devolver exactamente las filas que
    se espera borrar.
*/

----1) que se va a borrar (ejecutar primero y revisar)
WITH repetidas AS (
    SELECT codven, codusu, diferenciador,
           ROW_NUMBER() OVER (PARTITION BY codven, codusu, diferenciador, codgru, nombre
                              ORDER BY (SELECT NULL)) AS fila
    FROM tbl_api_vendedores_diferenciador
)
SELECT LTRIM(RTRIM(codven)) codven, LTRIM(RTRIM(codusu)) codusu,
       LTRIM(RTRIM(diferenciador)) diferenciador
FROM repetidas WHERE fila > 1;

----2) el borrado
WITH repetidas AS (
    SELECT ROW_NUMBER() OVER (PARTITION BY codven, codusu, diferenciador, codgru, nombre
                              ORDER BY (SELECT NULL)) AS fila
    FROM tbl_api_vendedores_diferenciador
)
DELETE FROM repetidas WHERE fila > 1;

----3) comprobacion: no debe devolver ninguna fila
SELECT LTRIM(RTRIM(codven)) codven, COUNT(*) veces
FROM tbl_api_vendedores_diferenciador
GROUP BY codven HAVING COUNT(*) > 1;
