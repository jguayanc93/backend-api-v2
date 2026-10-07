/*
    jc_lista_clientes  -  usado por POST /v1/lista/clientes

    La regla de negocio, que es lo que distingue las dos vistas:

      CARTERA    cuenta solo los clientes que le PERTENECEN y que el mismo facturo.
                 En mst01fac tienen que coincidir los dos campos: codven (de quien es el
                 cliente) y codven_usu (quien hizo la venta).

      COBERTURA  cuenta todo lo que el vendedor facturo, le pertenezca el cliente o no.
                 Solo mira codven_usu. Puede incluir clientes asignados a el y clientes
                 que no lo estan.

    ---------------------------------------------------------------------------------
    CAMBIOS (2026-10-05), tres:

    1) CARTERA: los dos conteos (facturas y notas de credito) filtraban solo por
       codven_usu. Se agrego codven=@vendedor, para que no cuenten las ventas que el
       vendedor hizo cuando el cliente todavia era de otro. Afecta a un 1-5% de las
       facturas segun el vendedor.

    2) COBERTURA: restaba los clientes asignados, asi que solo mostraba los "libres".
       Ahora lista todos los que facturo, con o sin asignacion, que es la regla real.
       La rama quedo mucho mas corta: sobraban tres tablas temporales.

    3) COBERTURA: el paso que contaba las facturas tenia el vendedor escrito a mano
       ('V0278') en vez del parametro. El conteo se calculaba solo sobre las facturas de
       ese vendedor, asi que para los demas la vista salia VACIA, sin dar error.
       Afectaba a 13 de los 14 vendedores con diferenciador COBERTURA.

    Las dos vistas siguen mirando SOLO el mes en curso, como antes.

    PENDIENTE: aplicar en produccion (bdnava01). Este script se corrio contra bdnava08.
*/
ALTER PROCEDURE [dbo].[jc_lista_clientes](
@codven varchar(12),
@lista varchar(10)
)
AS
BEGIN
SET NOCOUNT ON

DECLARE @vendedor varchar(12)

SET @vendedor=@codven

IF(@lista='cartera')
	BEGIN
	----primero las facturas del mes a clientes que son suyos: los dos campos deben coincidir
		select codcli,COUNT(codcli) as'facturas' into #cliente_atendidos from mst01fac where flag<>'*' and YEAR(fecha)=YEAR(GETDATE())
		and MONTH(fecha)=MONTH(GETDATE()) AND cdocu in('01','03') and codven_usu=@vendedor and codven=@vendedor group by codcli

	----segundo las notas de credito del mes, con el mismo criterio
		select codcli,COUNT(codcli) as'facturas' into #cliente_nc from mst01fac where flag<>'*' and YEAR(fecha)=YEAR(GETDATE())
		and MONTH(fecha)=MONTH(GETDATE()) AND cdocu in('07') and codven_usu=@vendedor and codven=@vendedor group by codcli

	----tercero sus clientes asignados, atendidos o no: los que salen en cero son los dejados
		select a.codcli,a.nomcli,ISNULL(b.facturas,0),ISNULL(c.facturas,0) from mst01cli a
		left join #cliente_atendidos b on (a.codcli=b.codcli)
		left join #cliente_nc c on (a.codcli=c.codcli)
		where a.codven=@vendedor AND a.estado=1
	END
IF(@lista='cobertura')
	BEGIN
	----todo lo que facturo este mes, sin mirar de quien es el cliente: solo codven_usu
		select codcli,COUNT(codcli) as'facturas' into #cliente_facturados from mst01fac
		where flag<>'*' and YEAR(fecha)=YEAR(GETDATE()) and MONTH(fecha)=MONTH(GETDATE())
		  AND cdocu in('01','03') and codven_usu=@vendedor group by codcli

	----se le pone nombre a cada uno
		select a.codcli,b.nomcli,a.facturas from #cliente_facturados a
		inner join mst01cli b on (b.codcli=a.codcli)
	END

END
