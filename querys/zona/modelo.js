/////Calendario y probabilidad de llegar a la cuota (grupo 34). Aqui no hay consultas: solo
/////cuentas sobre los datos que arma querys/zona/zona.js, para poder probarlo sin la base.
/////
/////Como se calcula la probabilidad (contrato: docs/zona-grupo34.md):
/////  1) lo que el vendedor ya facturo hasta ayer no se mueve
/////  2) hoy y cada dia habil que queda del mes se "rellenan" con un dia real del propio
/////     vendedor, sacado al azar de sus ultimos 90 dias (los sabados con sabados, porque un
/////     sabado se vende mucho menos). Hoy nunca vale menos de lo que ya facturo hoy
/////  3) se repite 10000 veces y se cuenta que parte de esos finales de mes llega a la meta
/////  4) esa parte se corrige con lo que paso de verdad (CALIBRACION): sola sale demasiado baja,
/////     porque el vendedor que va atrasado aprieta al final del mes y un dia sacado al azar no
/////     lo sabe. En dic-2025 a sep-2026, cuando decia 7 % llegaba la mitad.
/////Las notas de credito entran como dias en negativo, igual que en su avance.
/////La semilla sale del vendedor y del dia: con los mismos datos el numero no cambia entre dos
/////lecturas, y solo se mueve cuando entra una venta nueva.

const SIMULACIONES = 10000;
/////con menos dias habiles de historia el numero no dice nada (un vendedor nuevo)
const MINIMO_DIAS_HISTORIA = 20;
/////con menos sabados se usan sus dias de semana tambien para los sabados
const MINIMO_SABADOS = 4;

/////Correccion de la probabilidad simulada: p = 1/(1+e^-(a*logit(simulada)+b)). Ajustada con los
/////cierres reales de las cuotas de dic-2025 a sep-2026 (182 casos: 50 meses-vendedor cortados
/////en los dias 10, 15, 20 y 25). Error (brier) 0.12, contra 0.32 sin corregir y 0.16 diciendo
/////siempre el promedio. Probado mes por mes con un ajuste hecho sin ese mes: cuando dice 38 %
/////llego el 36 %, 70 % el 68 %, 87 % el 82 %. Recalcular con node querys/zona/calibrar.js.
const CALIBRACION = {a:0.596, b:2.404};
/////Si para llegar tiene que facturar por dia mas de esto por lo que suele facturar, no se corrige:
/////en esos meses nadie llego (0 de 8).
const TOPE_RITMO = 2.5;

/////Feriados nacionales de dia fijo (MM-DD). Se comprobo en mst01fac: esos dias la empresa no
/////factura (2025 y 2026). Jueves y Viernes Santo se calculan aparte.
const FERIADOS_FIJOS = ['01-01','05-01','06-07','06-29','07-23','07-28','07-29','08-06','08-30',
                        '10-08','11-01','12-08','12-09','12-25'];

/////Fechas como texto AAAA-MM-DD y cuentas en UTC: asi el huso horario del servidor no mueve
/////ningun dia.
function aFecha(texto){ const [a,m,d] = texto.split('-').map(Number); return new Date(Date.UTC(a, m-1, d)); }
function aTexto(fecha){ return fecha.toISOString().slice(0,10); }
function sumarDias(texto, dias){ const f = aFecha(texto); f.setUTCDate(f.getUTCDate() + dias); return aTexto(f); }
function diasDelMes(anno, mes){ return new Date(Date.UTC(anno, mes, 0)).getUTCDate(); }
function fechaDe(anno, mes, dia){ return `${anno}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`; }

/////Domingo de Pascua (algoritmo gregoriano anonimo)
function pascua(anno){
    const a = anno % 19, b = Math.floor(anno/100), c = anno % 100, d = Math.floor(b/4), e = b % 4;
    const f = Math.floor((b+8)/25), g = Math.floor((b-f+1)/3), h = (19*a + b - d - g + 15) % 30;
    const i = Math.floor(c/4), k = c % 4, l = (32 + 2*e + 2*i - h - k) % 7, m = Math.floor((a + 11*h + 22*l)/451);
    const mes = Math.floor((h + l - 7*m + 114)/31), dia = ((h + l - 7*m + 114) % 31) + 1;
    return fechaDe(anno, mes, dia);
}
function esFeriado(texto){
    if(FERIADOS_FIJOS.includes(texto.slice(5))) return true;
    const domingo = pascua(Number(texto.slice(0,4)));
    return texto === sumarDias(domingo, -3) || texto === sumarDias(domingo, -2);
}
/////'habil' (lunes a viernes), 'sabado', o null si no se vende (domingo o feriado)
function tipoDia(texto){
    const semana = aFecha(texto).getUTCDay();
    if(semana === 0 || esFeriado(texto)) return null;
    return semana === 6 ? 'sabado' : 'habil';
}
/////Dias en que se vende desde `desde` hasta el fin del mes, contando `desde`
function diasQueQuedan(desde){
    const quedan = {habil:0, sabado:0};
    const fin = fechaDe(Number(desde.slice(0,4)), Number(desde.slice(5,7)), diasDelMes(Number(desde.slice(0,4)), Number(desde.slice(5,7))));
    for(let d = desde; d <= fin; d = sumarDias(d, 1)){
        const t = tipoDia(d);
        if(t) quedan[t]++;
    }
    return quedan;
}

/////Generador con semilla (mulberry32): el mismo vendedor el mismo dia da el mismo numero
function generador(semilla){
    let t = semilla >>> 0;
    return ()=>{
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ t >>> 15, 1 | t);
        r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
        return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
}
function semillaDe(texto){
    let h = 2166136261;
    for(const ch of texto){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
function redondear(n){ return n == null ? null : Math.round((n + Number.EPSILON) * 100) / 100; }
function calibrar(simulada){
    const p = Math.min(Math.max(simulada, 0.005), 0.995);
    return 1 / (1 + Math.exp(-(CALIBRACION.a * Math.log(p / (1 - p)) + CALIBRACION.b)));
}
function percentil(ordenados, p){ return ordenados[Math.min(ordenados.length - 1, Math.floor(p * ordenados.length))]; }

/////La historia de un vendedor: lo que facturo cada dia en que la empresa facturo, en los
/////`dias` anteriores al corte. Un dia sin ventas suyas cuenta como 0. Si su primera venta
/////en ese tramo es posterior al inicio, la historia empieza ahi (vendedor nuevo o que volvio).
/////  ventas: {AAAA-MM-DD: monto} del vendedor
/////  diasEmpresa: dias en que la empresa facturo, ordenados
function historiaDe(ventas, diasEmpresa, corte, dias){
    const desde = sumarDias(corte, -dias);
    const tramo = diasEmpresa.filter(d=>d >= desde && d < corte);
    const primera = tramo.find(d=>ventas[d] != null);
    const historia = {habil:[], sabado:[]};
    if(!primera) return historia;
    tramo.filter(d=>d >= primera).forEach(d=>{
        const t = aFecha(d).getUTCDay() === 6 ? 'sabado' : 'habil';
        historia[t].push(ventas[d] || 0);
    });
    return historia;
}

/////Probabilidad de llegar a la meta al cierre del mes.
/////  meta, cerrado (facturado hasta ayer), hoy {vendido, tipo: 'habil'|'sabado'|null},
/////  quedan {habil, sabado} SIN contar hoy, historia {habil:[], sabado:[]}, semilla (texto)
/////Devuelve {probabilidad (0-100), escenarios {pesimista, probable, optimista}, ritmo, motivo}
function probabilidad({meta, cerrado, hoy, quedan, historia, semilla}){
    const vendidoHoy = hoy ? hoy.vendido || 0 : 0;
    const avance = cerrado + vendidoHoy;
    const dias = quedan.habil + quedan.sabado + (hoy && hoy.tipo ? 1 : 0);
    const falta = meta > 0 ? Math.max(meta - avance, 0) : null;
    const todos = historia.habil.concat(historia.sabado);
    const ritmo = {
        /////lo que tiene que facturar cada dia que queda (hoy incluido) para llegar
        necesario: falta == null || dias === 0 ? null : redondear(falta / dias),
        /////lo que suele facturar por dia en que se vende (sabados incluidos)
        habitual: todos.length ? redondear(todos.reduce((s,v)=>s+v, 0) / todos.length) : null
    };
    /////Los finales de mes simulados. Se simula aunque no tenga cuota o ya haya llegado: los
    /////escenarios (y la proyeccion de la lista de avance) sirven igual.
    let finales = null;
    if(dias > 0 && historia.habil.length >= MINIMO_DIAS_HISTORIA){
        const habiles = historia.habil;
        const sabados = historia.sabado.length >= MINIMO_SABADOS ? historia.sabado : habiles;
        const azar = generador(semillaDe(semilla));
        const tomar = (lista)=>lista[Math.floor(azar() * lista.length)];
        finales = new Array(SIMULACIONES);
        for(let s = 0; s < SIMULACIONES; s++){
            let total = cerrado;
            if(hoy && hoy.tipo) total += Math.max(tomar(hoy.tipo === 'sabado' ? sabados : habiles), vendidoHoy);
            else total += vendidoHoy;
            for(let i = 0; i < quedan.habil; i++) total += tomar(habiles);
            for(let i = 0; i < quedan.sabado; i++) total += tomar(sabados);
            finales[s] = total;
        }
        finales.sort((a,b)=>a-b);
    }
    /////como cerraria el mes SI SIGUE A SU RITMO de los ultimos 90 dias: 1 de cada 10 veces peor
    /////que el pesimista, la mitad por encima del probable, 1 de cada 10 mejor que el optimista.
    /////No llevan la correccion: no cuentan con que apriete al final. Sin dias que queden, lo que
    /////lleva; sin historia, null.
    const escenarios = finales
        ? {pesimista: redondear(percentil(finales, 0.1)), probable: redondear(percentil(finales, 0.5)),
           optimista: redondear(percentil(finales, 0.9))}
        : dias === 0 ? {pesimista: redondear(avance), probable: redondear(avance), optimista: redondear(avance)} : null;
    const salida = (p, motivo)=>({probabilidad:p, escenarios, ritmo, motivo});

    if(!(meta > 0)) return salida(null, 'sin cuota');
    if(avance >= meta) return salida(100, 'meta alcanzada');
    if(dias === 0) return salida(0, 'mes cerrado');
    if(!finales) return salida(null, 'historia insuficiente');

    const simulada = finales.filter(t=>t >= meta).length / SIMULACIONES;
    const imposible = ritmo.habitual > 0 && ritmo.necesario > TOPE_RITMO * ritmo.habitual;
    return Object.assign(salida(Math.round((imposible ? simulada : calibrar(simulada)) * 1000) / 10, null), {simulada});
}

/////El calculo completo para un vendedor en un mes, "a la altura" del dia `corte`:
/////  ventas {AAAA-MM-DD: monto}, diasEmpresa [...], meta, corte AAAA-MM-DD, diasHistoria
function probabilidadAlCorte({ventas, diasEmpresa, meta, corte, diasHistoria, semilla}){
    const inicio = corte.slice(0,8) + '01';
    let cerrado = 0;
    Object.keys(ventas).forEach(d=>{ if(d >= inicio && d < corte) cerrado += ventas[d]; });
    const hoy = {vendido: ventas[corte] || 0, tipo: tipoDia(corte)};
    const manana = sumarDias(corte, 1);
    const quedan = manana.slice(0,7) === corte.slice(0,7) ? diasQueQuedan(manana) : {habil:0, sabado:0};
    const historia = historiaDe(ventas, diasEmpresa, corte, diasHistoria);
    const r = probabilidad({meta, cerrado, hoy, quedan, historia, semilla});
    return Object.assign(r, {
        avance: redondear(cerrado + hoy.vendido),
        quedan: {habiles: quedan.habil + (hoy.tipo === 'habil' ? 1 : 0), sabados: quedan.sabado + (hoy.tipo === 'sabado' ? 1 : 0)}
    });
}

module.exports={
    SIMULACIONES, MINIMO_DIAS_HISTORIA, CALIBRACION, TOPE_RITMO,
    aTexto, sumarDias, diasDelMes, fechaDe, tipoDia, diasQueQuedan, historiaDe,
    probabilidad, probabilidadAlCorte, redondear
};
