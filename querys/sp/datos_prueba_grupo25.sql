/*
    Datos de prueba del grupo 25 (marcas y reportes)  -  SOLO bdnava08

    Arma, para el MES EN CURSO, los casos que el frontend necesita recorrer (respuesta-reportes.md,
    seccion 4·C). Se puede correr de nuevo cada mes: primero borra lo que este script carga.

    Usuarios:
      071 COSSIO JOANNA   jefatura de la familia 09 (Almacenamiento externo). Su marca propia
                          ACER, confirmada. Tiene a tres especialistas con marcas de su familia.
                          No esta registrada en la intranet: al entrar pasa por el registro.
      229 SAUÑE MANUEL    especialista CONFIRMADO con TDK (09), EPSON (05), RICOH (05) y
                          GIGABYTE (06). EPSON tiene stock negativo; RICOH productos sin compra
                          desde 2023; GIGABYTE es la marca mas grande (712 productos) y tiene
                          productos con precio 0. EPSON, RICOH y GIGABYTE son de otras familias:
                          la jefatura 071 NO debe verlas.
      233 HUARANCCA SAMUEL especialista con ADATA (09) dada por la jefatura y SIN CONFIRMAR.
                          ADATA tiene productos sin alta en M&M.
      192 OLIVARES ALEXANDER especialista con AVERY, una marca SIN PRODUCTOS VIGENTES, dada por
                          la jefatura y sin confirmar. AVERY se incorpora a la familia 09.
      270 RUBIÑOS ANDERSON especialista SIN NINGUNA MARCA este mes.
      094 TRINIDAD PATRICIA grupo 25 SIN REGISTRAR en la intranet.
      246 GONZALES CRISTOPHER grupo 20 (otro grupo).

    DAHUA (0182) es de la familia 09 y queda LIBRE: no debe salir en los reportes de la jefatura.
*/

SET XACT_ABORT ON;
BEGIN TRAN;

DECLARE @anno int = YEAR(GETDATE()), @mes int = MONTH(GETDATE());

----1) limpiar lo que este script carga, por si se corre de nuevo
DELETE FROM tbl01_api_marcas_asignadas
 WHERE anno=@anno AND mes=@mes
   AND (codusu IN ('071','229','233','192','270') OR codmar IN ('0124','0002','0008','0130','0049','0032','0013','0182'));
DELETE FROM tbl01_api_marcas_confirmadas
 WHERE anno=@anno AND mes=@mes AND codusu IN ('071','229','233','192','270');

----2) AVERY al catalogo, en la familia 09 (no tiene productos vigentes)
IF NOT EXISTS (SELECT 1 FROM tbl01_api_marcas_estado WHERE codmar='0013')
    INSERT INTO tbl01_api_marcas_estado(codmar,codfam,trabajada,codusu) VALUES('0013','09',1,'071');

----3) las asignaciones
INSERT INTO tbl01_api_marcas_asignadas(anno,mes,codmar,codusu,asignado_por) VALUES
    (@anno,@mes,'0124','071','071'),   -- ACER, propia de la jefatura
    (@anno,@mes,'0002','229','229'),   -- TDK
    (@anno,@mes,'0008','229','229'),   -- EPSON
    (@anno,@mes,'0130','229','229'),   -- RICOH
    (@anno,@mes,'0049','229','229'),   -- GIGABYTE
    (@anno,@mes,'0032','233','071'),   -- ADATA, dada por la jefatura
    (@anno,@mes,'0013','192','071');   -- AVERY, dada por la jefatura

----4) quienes ya confirmaron
INSERT INTO tbl01_api_marcas_confirmadas(anno,mes,codusu) VALUES
    (@anno,@mes,'071'),
    (@anno,@mes,'229');

COMMIT;

----comprobacion
SELECT a.codusu, RTRIM(u.nomusu) usuario, a.codmar, RTRIM(m.abrmar) marca, e.codfam, a.asignado_por,
       CASE WHEN c.codusu IS NULL THEN 'no' ELSE 'si' END confirmado
FROM tbl01_api_marcas_asignadas a
JOIN tbl01mar m ON m.codmar=a.codmar
LEFT JOIN tbl01_api_marcas_estado e ON e.codmar=a.codmar
LEFT JOIN fcu0000 u ON u.codusu=a.codusu
LEFT JOIN tbl01_api_marcas_confirmadas c ON c.anno=a.anno AND c.mes=a.mes AND c.codusu=a.codusu
WHERE a.anno=YEAR(GETDATE()) AND a.mes=MONTH(GETDATE())
ORDER BY a.codusu, m.abrmar;

/*
----para BORRAR los datos de prueba (correr a mano):
DELETE FROM tbl01_api_marcas_asignadas
 WHERE anno=YEAR(GETDATE()) AND mes=MONTH(GETDATE())
   AND (codusu IN ('071','229','233','192','270') OR codmar IN ('0124','0002','0008','0130','0049','0032','0013','0182'));
DELETE FROM tbl01_api_marcas_confirmadas
 WHERE anno=YEAR(GETDATE()) AND mes=MONTH(GETDATE()) AND codusu IN ('071','229','233','192','270');
DELETE FROM tbl01_api_marcas_estado WHERE codmar='0013';
*/
