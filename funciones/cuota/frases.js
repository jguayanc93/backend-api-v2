/////Las frases del "Estado" de la cuota, por tramo de avance.
/////
/////Este archivo es para editar sin tocar codigo: agregar, quitar o cambiar frases no
/////requiere mas que escribir dentro de la lista del tramo. Los cortes son los mismos que
/////tenia el switch de antes, asi que nadie va a ver un tramo distinto del que veia.
/////
/////La frase rota con el dia del mes: con cuatro o cinco por tramo, el vendedor que entra
/////todos los dias no ve la misma dos veces seguidas aunque su avance no se mueva.

const TRAMOS = [
    {hasta: 5, frases: [
        "que asi se chambea?",
        "esto recien empieza, como el primer episodio",
        "arranca el motor que la carrera ya salio",
        "todavia estas en el planeta Tierra, Goku",
        "cero coma algo, pero cero coma algo es mas que cero"
    ]},
    {hasta: 10, frases: [
        "comensando a calentar",
        "ya estas entrenando con Roshi",
        "el primer paso es el que cuesta",
        "poco a poco, que Roma tampoco se vendio en un dia",
        "calentando motores, Toretto"
    ]},
    {hasta: 20, frases: [
        "ya terminaste de vender a los clientes seguros del mes",
        "lo facil ya esta, ahora viene lo bueno",
        "nivel uno superado, siguen los jefes",
        "Rocky tambien empezo corriendo solo",
        "ya saliste de la Comarca, falta el camino"
    ]},
    {hasta: 30, frases: [
        "ya tienes un tercio",
        "un tercio dentro, dos por conquistar",
        "esto ya parece una venta y no un intento",
        "la fuerza te acompaña, pero todavia a media potencia",
        "vas armando el equipo, como Avengers"
    ]},
    {hasta: 40, frases: [
        "ponte la camiseta tio",
        "ya se te ve el potencial de Super Saiyajin",
        "no aflojes que recien se pone interesante",
        "a este ritmo llegas, pero sin dormirte",
        "ya pasaste la mitad de la mitad"
    ]},
    {hasta: 50, frases: [
        "WEEEEENA mitad desbloqueado",
        "mitad de camino, como Frodo en Rivendel",
        "50 por ciento: oficialmente ya no es casualidad",
        "la mitad esta hecha, la otra mitad te esta esperando",
        "Kame Hame... todavia te falta la Ha"
    ]},
    {hasta: 60, frases: [
        "no esperes que te pasen pedidos, buscalos",
        "mas de la mitad, pero la comision no se paga aqui",
        "ya pasaste la mitad, ahora acelera",
        "esto es lo que separa al que llega del que casi",
        "ya puedes ver la meta desde aqui, Simba"
    ]},
    {hasta: 70, frases: [
        "buen monto pero no para comisionar",
        "cerca, pero cerca no cobra",
        "ya estas en modo Kaio-ken, no lo sueltes",
        "setenta es buen numero, pero no es EL numero",
        "mision posible, pero sigue siendo mision"
    ]},
    {hasta: 80, frases: [
        "un poco mas de esfuerso y llegamos al minimo para comisionar",
        "estas a un buen pedido de cambiar el mes",
        "ya casi, no te relajes ahora",
        "la carga del anillo pesa mas al final, Sam",
        "no te detengas que ya se ve la linea"
    ]},
    {hasta: 90, frases: [
        "apurate goku, ya casi llegas a tu destino",
        "esto ya es tuyo si no aflojas",
        "un ultimo empujon y lo tienes",
        "estas a una venta de contarlo como hazaña",
        "la Genkidama ya esta cargada, solo falta lanzarla"
    ]},
    {hasta: 100, frases: [
        "la PIZZA ya esta en camino apurate",
        "a un paso. UN paso.",
        "esto ya es el ultimo round, Rocky",
        "no te quedes a las puertas, entra",
        "99 por ciento sigue siendo no llegar: cierra"
    ]},
    {hasta: Infinity, frases: [
        "TU SI ERES VENDEDOR NO COMO EL DE TU COSTADO",
        "mision cumplida, y con estilo",
        "superaste la cuota: nivel Super Saiyajin desbloqueado",
        "al infinito y mas alla",
        "esto ya no es cumplir, esto es presumir",
        "te pasaste de la meta y del presupuesto de efectos especiales"
    ]}
];

/////Devuelve la frase del tramo en el que cae el porcentaje.
/////
/////"semilla" sirve para rotar: se le pasa el dia del mes, asi la frase cambia de un dia
/////a otro aunque el avance sea el mismo. Si no llega, se usa la primera del tramo.
function frase(porcentaje, semilla){
    const p = Number(porcentaje);
    if(!isFinite(p)) return "sin datos de avance";

    const tramo = TRAMOS.find(t => p <= t.hasta) || TRAMOS[TRAMOS.length-1];
    const lista = tramo.frases;
    const n = Number(semilla);
    const indice = isFinite(n) ? (Math.abs(Math.trunc(n)) % lista.length) : 0;
    return lista[indice];
}

/////cuantas frases hay en total, por si alguna vez se quiere comprobar de un vistazo
function cuantas(){
    return TRAMOS.reduce((suma,t)=>suma + t.frases.length, 0);
}

module.exports = {frase, cuantas, TRAMOS};
