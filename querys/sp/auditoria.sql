/*
    Auditoria de la intranet  -  dos tablas

      tbl_api_auditoria   que hizo cada usuario: la accion, sobre que documento, con que
                          resultado y desde que dispositivo
      tbl_api_sesiones    cuando entro y desde donde

    Son tablas NUEVAS de la intranet. No tocan nada del ERP.

    Por que dos y no una: una sesion dura horas y genera una fila; las acciones son muchas
    y cortas. Mezclarlas obligaria a dejar medio registro vacio en cada fila.

    CRECIMIENTO ESPERADO
    --------------------
    Solo se registran las acciones que ESCRIBEN, no las consultas: un vendedor que mira
    listas todo el dia no deja rastro, y uno que crea diez cotizaciones deja diez filas.
    Con 27 usuarios activos son del orden de unos cientos de filas al dia.

    El indice por fecha es el que importa: casi todas las consultas van a ser "que paso
    hoy" o "que hizo fulano esta semana".
*/

----------------------------------------------------------------------------------------
---- 1) Las acciones
----------------------------------------------------------------------------------------
CREATE TABLE dbo.tbl_api_auditoria(
    id            bigint IDENTITY(1,1) NOT NULL,
    fecha         datetime      NOT NULL CONSTRAINT DF_auditoria_fecha DEFAULT (GETDATE()),

    ----quien: los dos identificadores, porque la intranet usa uno y el ERP el otro
    codusu        varchar(12)   NULL,
    codven        varchar(12)   NULL,
    nombre        varchar(60)   NULL,
    grupo         varchar(10)   NULL,

    ----que
    modulo        varchar(20)   NOT NULL,   -- cotizacion, promocion, factura, pedido, cuota
    accion        varchar(30)   NOT NULL,   -- crear, update, eliminar, acoplar, flete...
    documento     varchar(16)   NULL,       -- sobre que documento, si aplica

    ----como acabo
    resultado     varchar(30)   NOT NULL,   -- 'ok' o el status del rechazo
    http          smallint      NULL,

    ----desde donde
    dispositivo   varchar(10)   NULL,       -- movil, tablet, desktop
    sistema       varchar(20)   NULL,       -- Android, iOS, Windows, macOS, Linux
    navegador     varchar(20)   NULL,       -- Chrome, Edge, Firefox, Safari
    ip            varchar(45)   NULL,

    detalle       varchar(400)  NULL,       -- lo que haga falta, en texto

    CONSTRAINT PK_tbl_api_auditoria PRIMARY KEY CLUSTERED (id)
);

CREATE INDEX IX_auditoria_fecha   ON dbo.tbl_api_auditoria (fecha DESC);
CREATE INDEX IX_auditoria_usuario ON dbo.tbl_api_auditoria (codven, fecha DESC);
CREATE INDEX IX_auditoria_doc     ON dbo.tbl_api_auditoria (documento);

----------------------------------------------------------------------------------------
---- 2) Las sesiones
----------------------------------------------------------------------------------------
CREATE TABLE dbo.tbl_api_sesiones(
    id            bigint IDENTITY(1,1) NOT NULL,
    fecha         datetime      NOT NULL CONSTRAINT DF_sesiones_fecha DEFAULT (GETDATE()),

    codusu        varchar(12)   NULL,
    codven        varchar(12)   NULL,
    nombre        varchar(60)   NULL,
    grupo         varchar(10)   NULL,
    diferenciador varchar(20)   NULL,       -- COBERTURA, CARTERA, ESPECIALISTA...

    evento        varchar(12)   NOT NULL,   -- entrada, salida, rechazo
    motivo        varchar(40)   NULL,       -- por que se rechazo, si se rechazo

    dispositivo   varchar(10)   NULL,
    sistema       varchar(20)   NULL,
    navegador     varchar(20)   NULL,
    ip            varchar(45)   NULL,
    agente        varchar(250)  NULL,       -- el User-Agent crudo, por si hace falta mirar

    CONSTRAINT PK_tbl_api_sesiones PRIMARY KEY CLUSTERED (id)
);

CREATE INDEX IX_sesiones_fecha   ON dbo.tbl_api_sesiones (fecha DESC);
CREATE INDEX IX_sesiones_usuario ON dbo.tbl_api_sesiones (codven, fecha DESC);

----------------------------------------------------------------------------------------
---- 3) Comprobacion
----------------------------------------------------------------------------------------
SELECT 'tbl_api_auditoria' AS tabla, COUNT(*) AS filas FROM dbo.tbl_api_auditoria
UNION ALL
SELECT 'tbl_api_sesiones', COUNT(*) FROM dbo.tbl_api_sesiones;

/*
    PARA DESHACER:

        DROP TABLE dbo.tbl_api_auditoria;
        DROP TABLE dbo.tbl_api_sesiones;

    El backend funciona igual si las tablas no existen: la auditoria falla en silencio y
    la peticion sigue su curso. Nunca debe tumbar una operacion por no poder registrarla.
*/
