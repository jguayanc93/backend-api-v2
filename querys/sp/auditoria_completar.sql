/*
    tbl_api_auditoria y tbl_api_sesiones  -  completar lo que les falta

    En bdnava08 (y segun lo revisado, tambien en produccion) las dos tablas se crearon solo
    con sus columnas, sin lo demas que define auditoria.sql:

      - el DEFAULT (GETDATE()) de fecha. Es lo grave: fecha es NOT NULL y el backend no la
        manda, asi que CADA insert falla con "Cannot insert the value NULL into column
        'fecha'". Como la auditoria nunca tumba la peticion, el fallo solo aparece en el log
        del servidor y las tablas se quedan vacias.
      - la clave primaria sobre id
      - los indices por fecha, usuario y documento

    El script se puede correr mas de una vez: cada paso comprueba si ya esta hecho.
    Ejecutarlo en cada base (bdnava08 ya esta hecha) y revisar la comprobacion del final.
*/

SET XACT_ABORT ON;
BEGIN TRAN;

----1) los DEFAULT de fecha
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.tbl_api_auditoria') AND name='fecha' AND default_object_id<>0)
    ALTER TABLE dbo.tbl_api_auditoria ADD CONSTRAINT DF_auditoria_fecha DEFAULT (GETDATE()) FOR fecha;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.tbl_api_sesiones') AND name='fecha' AND default_object_id<>0)
    ALTER TABLE dbo.tbl_api_sesiones ADD CONSTRAINT DF_sesiones_fecha DEFAULT (GETDATE()) FOR fecha;

----2) las claves primarias
IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID('dbo.tbl_api_auditoria') AND type='PK')
    ALTER TABLE dbo.tbl_api_auditoria ADD CONSTRAINT PK_tbl_api_auditoria PRIMARY KEY CLUSTERED (id);

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID('dbo.tbl_api_sesiones') AND type='PK')
    ALTER TABLE dbo.tbl_api_sesiones ADD CONSTRAINT PK_tbl_api_sesiones PRIMARY KEY CLUSTERED (id);

----3) los indices
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.tbl_api_auditoria') AND name='IX_auditoria_fecha')
    CREATE INDEX IX_auditoria_fecha   ON dbo.tbl_api_auditoria (fecha DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.tbl_api_auditoria') AND name='IX_auditoria_usuario')
    CREATE INDEX IX_auditoria_usuario ON dbo.tbl_api_auditoria (codven, fecha DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.tbl_api_auditoria') AND name='IX_auditoria_doc')
    CREATE INDEX IX_auditoria_doc     ON dbo.tbl_api_auditoria (documento);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.tbl_api_sesiones') AND name='IX_sesiones_fecha')
    CREATE INDEX IX_sesiones_fecha    ON dbo.tbl_api_sesiones (fecha DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.tbl_api_sesiones') AND name='IX_sesiones_usuario')
    CREATE INDEX IX_sesiones_usuario  ON dbo.tbl_api_sesiones (codven, fecha DESC);

COMMIT;

----4) comprobacion: las dos filas deben decir default=1 y pk=1;
----   indices: 3 en tbl_api_auditoria (fecha, usuario, documento) y 2 en tbl_api_sesiones (fecha, usuario)
SELECT t.name tabla,
       CASE WHEN c.default_object_id<>0 THEN 1 ELSE 0 END [default],
       (SELECT COUNT(*) FROM sys.key_constraints k WHERE k.parent_object_id=t.object_id AND k.type='PK') pk,
       (SELECT COUNT(*) FROM sys.indexes i WHERE i.object_id=t.object_id AND i.name LIKE 'IX[_]%') indices
FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id AND c.name='fecha'
WHERE t.name IN ('tbl_api_auditoria','tbl_api_sesiones');
