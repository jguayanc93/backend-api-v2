/*
    Grupo 25 - tablas y datos iniciales para una base nueva (produccion)

    Crea las 7 tablas de los modulos del grupo 25 y carga lo minimo para que funcionen:
    el catalogo de marcas (con su familia) y las jefaturas. bdnava08 ya lo tiene.

    Se puede correr mas de una vez: cada paso comprueba si ya esta hecho.

    Antes de correrlo:
      - correr tambien querys/sp/auditoria_completar.sql (DEFAULT, PK e indices de la auditoria)
      - NO correr querys/sp/datos_prueba_grupo25.sql: son datos de prueba, solo para bdnava08

    Despues de correrlo, revisar la consulta 5 (marcas cuya familia es dudosa) y corregir a mano
    las que esten mal, como se hizo en bdnava08 (ASUS 0056 a la familia 02).
*/

SET XACT_ABORT ON;
BEGIN TRAN;

----------------------------------------------------------------------------------------
---- 1) tablas
----------------------------------------------------------------------------------------
-- una jefatura por familia, y una familia por jefatura
IF OBJECT_ID('dbo.tbl01_api_jefatura_familia') IS NULL
BEGIN
    CREATE TABLE dbo.tbl01_api_jefatura_familia (
        codfam   char(2)     NOT NULL PRIMARY KEY,
        codusu   varchar(6)  NOT NULL,
        fecreg   datetime    NOT NULL DEFAULT GETDATE()
    );
    CREATE UNIQUE INDEX ux_jefatura_familia_codusu ON dbo.tbl01_api_jefatura_familia(codusu);
END

-- catalogo de marcas: su familia y si se trabaja
IF OBJECT_ID('dbo.tbl01_api_marcas_estado') IS NULL
BEGIN
    CREATE TABLE dbo.tbl01_api_marcas_estado (
        codmar     char(4)     NOT NULL PRIMARY KEY,
        codfam     char(2)     NOT NULL,
        trabajada  bit         NOT NULL DEFAULT 1,
        codusu     varchar(6)  NULL,
        fecreg     datetime    NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX ix_marcas_estado_codfam ON dbo.tbl01_api_marcas_estado(codfam);
END

-- marcas asignadas por mes: una marca, un dueño
IF OBJECT_ID('dbo.tbl01_api_marcas_asignadas') IS NULL
BEGIN
    CREATE TABLE dbo.tbl01_api_marcas_asignadas (
        anno          int         NOT NULL,
        mes           int         NOT NULL,
        codmar        char(4)     NOT NULL,
        codusu        varchar(6)  NOT NULL,
        asignado_por  varchar(6)  NOT NULL,
        fecreg        datetime    NOT NULL DEFAULT GETDATE(),
        CONSTRAINT pk_marcas_asignadas PRIMARY KEY (anno, mes, codmar)
    );
    CREATE INDEX ix_marcas_asignadas_usuario ON dbo.tbl01_api_marcas_asignadas(codusu, anno, mes);
END

-- quien ya confirmo sus marcas del mes
IF OBJECT_ID('dbo.tbl01_api_marcas_confirmadas') IS NULL
    CREATE TABLE dbo.tbl01_api_marcas_confirmadas (
        anno    int         NOT NULL,
        mes     int         NOT NULL,
        codusu  varchar(6)  NOT NULL,
        fecreg  datetime    NOT NULL DEFAULT GETDATE(),
        CONSTRAINT pk_marcas_confirmadas PRIMARY KEY (anno, mes, codusu)
    );

-- metas de cuota por marca
IF OBJECT_ID('dbo.tbl01_api_marcas_meta') IS NULL
BEGIN
    CREATE TABLE dbo.tbl01_api_marcas_meta (
        anno               int            NOT NULL,
        mes                int            NOT NULL,
        codmar             char(4)        NOT NULL,
        codusu             varchar(6)     NOT NULL,
        meta_monto         decimal(14,2)  NULL,
        meta_margen        decimal(14,2)  NULL,
        meta_margen_pct    decimal(6,2)   NULL,
        meta_unidades      int            NULL,
        fecreg             datetime       NOT NULL DEFAULT GETDATE(),
        actualizado        datetime       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT pk_marcas_meta PRIMARY KEY (anno, mes, codmar)
    );
    CREATE INDEX ix_marcas_meta_usuario ON dbo.tbl01_api_marcas_meta(codusu, anno, mes);
END

-- ajuste de precios: una solicitud por documento y responsable
IF OBJECT_ID('dbo.tbl01_api_ajuste_solicitud') IS NULL
BEGIN
    CREATE TABLE dbo.tbl01_api_ajuste_solicitud (
        id             int IDENTITY(1,1) PRIMARY KEY,
        tipo           char(3)       NOT NULL,
        cdocu          char(2)       NOT NULL,
        ndocu          char(12)      NOT NULL,
        codusu_envia   varchar(6)    NOT NULL,
        codven_envia   varchar(10)   NULL,
        codusu_recibe  varchar(6)    NOT NULL,
        estado         varchar(12)   NOT NULL DEFAULT 'PENDIENTE',
        mensaje        varchar(300)  NULL,
        observacion    varchar(300)  NULL,
        fecreg         datetime      NOT NULL DEFAULT GETDATE(),
        vence          datetime      NOT NULL,
        fecrespuesta   datetime      NULL
    );
    CREATE INDEX ix_ajuste_recibe ON dbo.tbl01_api_ajuste_solicitud(codusu_recibe, estado);
    CREATE INDEX ix_ajuste_documento ON dbo.tbl01_api_ajuste_solicitud(cdocu, ndocu);
    CREATE UNIQUE INDEX ux_ajuste_pendiente ON dbo.tbl01_api_ajuste_solicitud(cdocu, ndocu, codusu_recibe)
        WHERE estado = 'PENDIENTE';
END

-- ajuste de precios: las lineas, con su antes y su despues
IF OBJECT_ID('dbo.tbl01_api_ajuste_detalle') IS NULL
    CREATE TABLE dbo.tbl01_api_ajuste_detalle (
        id_solicitud   int           NOT NULL,
        item           int           NOT NULL,
        codi           varchar(11)   NOT NULL,
        codmar         char(4)       NOT NULL,
        cant_antes     decimal(12,3) NOT NULL,
        preu_antes     decimal(14,4) NOT NULL,
        dsct_antes     decimal(6,2)  NOT NULL,
        cant_despues   decimal(12,3) NULL,
        preu_despues   decimal(14,4) NULL,
        costo          decimal(14,4) NULL,
        CONSTRAINT pk_ajuste_detalle PRIMARY KEY (id_solicitud, item)
    );

----------------------------------------------------------------------------------------
---- 2) catalogo de marcas: cada marca con productos vigentes en las familias comerciales,
----    en la familia donde tiene mas productos. Solo agrega las que falten.
----------------------------------------------------------------------------------------
;WITH a AS (
    SELECT codmar, LEFT(codi,2) f, COUNT(*) c
    FROM prd0101
    WHERE estado=1 AND codmar IS NOT NULL AND LEFT(codi,2) IN ('01','02','05','06','09','11','12')
    GROUP BY codmar, LEFT(codi,2)
), r AS (
    SELECT codmar, f, ROW_NUMBER() OVER(PARTITION BY codmar ORDER BY c DESC, f) rn FROM a
)
INSERT INTO dbo.tbl01_api_marcas_estado(codmar, codfam, trabajada)
SELECT r.codmar, r.f, 1
FROM r JOIN tbl01mar m ON m.codmar=r.codmar
WHERE r.rn=1 AND NOT EXISTS (SELECT 1 FROM dbo.tbl01_api_marcas_estado e WHERE e.codmar=r.codmar);

-- correcciones de negocio (decididas en bdnava08, 2026-10-14)
UPDATE e SET trabajada=0                       -- nadie las toma
FROM dbo.tbl01_api_marcas_estado e JOIN tbl01mar m ON m.codmar=e.codmar
WHERE RTRIM(m.abrmar) IN ('ND','HIKVI','IMATI','SONY','MAXEL') AND e.trabajada=1 AND e.codusu IS NULL;

UPDATE dbo.tbl01_api_marcas_estado SET codfam='02'   -- ASUS: sus notebooks son de equipos informaticos
WHERE codmar='0056' AND codfam<>'02' AND codusu IS NULL;

----------------------------------------------------------------------------------------
---- 3) jefaturas (2026-10-14). Las familias 01 y 05 no tienen jefatura.
----------------------------------------------------------------------------------------
INSERT INTO dbo.tbl01_api_jefatura_familia(codfam, codusu)
SELECT v.codfam, v.codusu
FROM (VALUES ('02','301'),   -- TINEO MARIA
             ('06','163'),   -- MICHUE RICARDO
             ('09','071'),   -- COSSIO JOANNA
             ('11','264'),   -- ATOCHE HEIDI
             ('12','218')    -- FULCA ROBERT
     ) v(codfam, codusu)
WHERE NOT EXISTS (SELECT 1 FROM dbo.tbl01_api_jefatura_familia j WHERE j.codfam=v.codfam)
  AND NOT EXISTS (SELECT 1 FROM dbo.tbl01_api_jefatura_familia j WHERE j.codusu=v.codusu);

COMMIT;

----------------------------------------------------------------------------------------
---- 4) comprobacion: las 7 tablas, y cuantas marcas y jefaturas quedaron
----------------------------------------------------------------------------------------
SELECT name AS tabla FROM sys.tables
WHERE name IN ('tbl01_api_jefatura_familia','tbl01_api_marcas_estado','tbl01_api_marcas_asignadas',
               'tbl01_api_marcas_confirmadas','tbl01_api_marcas_meta',
               'tbl01_api_ajuste_solicitud','tbl01_api_ajuste_detalle')
ORDER BY name;                                                        -- deben ser 7

SELECT e.codfam, f.nomfam, COUNT(*) marcas, SUM(CASE WHEN e.trabajada=1 THEN 1 ELSE 0 END) trabajadas,
       MAX(RTRIM(u.nomusu)) jefatura
FROM dbo.tbl01_api_marcas_estado e
JOIN tbl01fam f ON f.codfam=e.codfam
LEFT JOIN dbo.tbl01_api_jefatura_familia j ON j.codfam=e.codfam
LEFT JOIN fcu0000 u ON u.codusu=j.codusu
GROUP BY e.codfam, f.nomfam ORDER BY e.codfam;

----------------------------------------------------------------------------------------
---- 5) para revisar: marcas repartidas entre familias (menos del 80 % en la elegida)
----------------------------------------------------------------------------------------
;WITH a AS (
    SELECT codmar, LEFT(codi,2) f, COUNT(*) c
    FROM prd0101
    WHERE estado=1 AND codmar IS NOT NULL AND LEFT(codi,2) IN ('01','02','05','06','09','11','12')
    GROUP BY codmar, LEFT(codi,2)
), t AS (SELECT codmar, SUM(c) total FROM a GROUP BY codmar)
SELECT e.codmar, RTRIM(m.abrmar) marca, e.codfam familia_elegida, a.c en_esa_familia, t.total
FROM dbo.tbl01_api_marcas_estado e
JOIN tbl01mar m ON m.codmar=e.codmar
JOIN t ON t.codmar=e.codmar
LEFT JOIN a ON a.codmar=e.codmar AND a.f=e.codfam
WHERE ISNULL(a.c,0) * 1.0 / t.total < 0.8
ORDER BY e.codmar;
