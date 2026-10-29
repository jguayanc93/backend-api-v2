/////Cuando se puede ofrecer y aplicar una promocion (2026-10-29): encendida (estado=1) y hoy entre su
/////fecha de inicio y su fecha de fin. Se compara por dia: fecfin llega con hora (23:30) o a medianoche,
/////y la promocion vale todo su ultimo dia. El dia es el del servidor de base de datos (hora de Lima).
/////
/////Antes los buscadores de la cotizacion solo miraban estado=1 y se seguian aplicando las vencidas.
/////La usan la pantalla de promociones vigentes y los que arman o aplican una promocion en la cotizacion
/////(buscador, buscador_part1, promocion_id y promheader_simple1). Retirar una promocion ya puesta en una
/////cotizacion no la usa: eso siempre debe poder hacerse.
/////Una promocion sin fecha (NULL) no se considera vigente; hoy no hay ninguna encendida sin ella.
const vigente = (alias)=>`${alias}.estado=1
     and cast(${alias}.fecini as date)<=cast(getdate() as date)
     and cast(getdate() as date)<=cast(${alias}.fecfin as date)`;

module.exports={vigente}
