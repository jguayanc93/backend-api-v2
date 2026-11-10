/*
    Ajuste directo y asignacion (grupo 25) - las 3 tablas nuevas, para una base que ya tiene el grupo 25

    Solo crea tablas: no toca datos. Se puede correr mas de una vez: si una tabla o un indice ya existe,
    no hace nada. bdnava08 ya las tiene (06/11/2026). Para una base nueva, querys/sp/grupo25_produccion.sql
    las crea junto con todo lo demas.

    Contrato: docs/ajuste-directo.md. Despliegue: docs/despliegue-ajuste-directo.md
*/

SET XACT_ABORT ON;
BEGIN TRAN;

-- cada vez que el jefe de marca aplica precios a su propio documento
IF OBJECT_ID('dbo.tbl01_api_ajuste_directo') IS NULL
    CREATE TABLE dbo.tbl01_api_ajuste_directo (
        id            int IDENTITY(1,1) PRIMARY KEY,
        tipo          char(3)       NOT NULL,
        cdocu         char(2)       NOT NULL,
        ndocu         char(12)      NOT NULL,
        codusu        varchar(6)    NOT NULL,
        observacion   varchar(300)  NULL,
        promociones   int           NOT NULL,
        totn_antes    decimal(14,2) NOT NULL,
        totn_despues  decimal(14,2) NOT NULL,
        fecreg        datetime      NOT NULL DEFAULT GETDATE()
    );
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_ajuste_directo_doc')
    EXEC('CREATE INDEX ix_ajuste_directo_doc ON dbo.tbl01_api_ajuste_directo(cdocu, ndocu)');

-- sus lineas, con el antes y el despues
IF OBJECT_ID('dbo.tbl01_api_ajuste_directo_detalle') IS NULL
    CREATE TABLE dbo.tbl01_api_ajuste_directo_detalle (
        id_ajuste     int           NOT NULL,
        item          int           NOT NULL,
        codi          varchar(11)   NOT NULL,
        codmar        char(4)       NOT NULL,
        cant          decimal(12,3) NOT NULL,
        preu_antes    decimal(14,4) NOT NULL,
        dsct_antes    decimal(6,2)  NOT NULL,
        preu_despues  decimal(14,4) NOT NULL,
        costo         decimal(14,4) NOT NULL,
        CONSTRAINT pk_ajuste_directo_detalle PRIMARY KEY (id_ajuste, item)
    );

-- documentos del grupo 25 asignados a un vendedor del grupo 20
IF OBJECT_ID('dbo.tbl01_api_documento_asignado') IS NULL
    CREATE TABLE dbo.tbl01_api_documento_asignado (
        id            int IDENTITY(1,1) PRIMARY KEY,
        tipo          char(3)       NOT NULL,
        cdocu         char(2)       NOT NULL,
        ndocu         char(12)      NOT NULL,
        codusu_asigna varchar(6)    NOT NULL,
        codven_antes  varchar(10)   NOT NULL,
        codven_nuevo  varchar(10)   NOT NULL,
        totn          decimal(14,2) NOT NULL,
        fecreg        datetime      NOT NULL DEFAULT GETDATE()
    );
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_doc_asignado_asigna')
    EXEC('CREATE INDEX ix_doc_asignado_asigna ON dbo.tbl01_api_documento_asignado(codusu_asigna, fecreg)');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_doc_asignado_doc')
    EXEC('CREATE INDEX ix_doc_asignado_doc ON dbo.tbl01_api_documento_asignado(cdocu, ndocu)');

COMMIT;

----comprobacion: deben salir las 3 tablas, y 3 indices ademas de las llaves
SELECT name AS tabla FROM sys.tables
WHERE name IN ('tbl01_api_ajuste_directo','tbl01_api_ajuste_directo_detalle','tbl01_api_documento_asignado')
ORDER BY name;
SELECT name AS indice FROM sys.indexes
WHERE name IN ('ix_ajuste_directo_doc','ix_doc_asignado_asigna','ix_doc_asignado_doc')
ORDER BY name;
