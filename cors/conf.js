const corhabilitaciones2={
    origin:"http://127.0.0.1",
    methods:['GET','POST'],
    credentials:true
}

/////Origenes extra solo para el servidor de prueba, separados por coma. Por ejemplo, en su
/////.env: CORS_ORIGENES_EXTRA=http://127.0.0.1:8080 (desde ahi prueba el frontend).
/////En produccion no se define y solo se acepta la landing.
const ORIGENES_EXTRA = String(process.env.CORS_ORIGENES_EXTRA || '').split(',').map(o=>o.trim()).filter(Boolean);

const corhabilitaciones={
    origin: ORIGENES_EXTRA.length ? ["https://landing.compudiskett.com.pe"].concat(ORIGENES_EXTRA)
                                  : "https://landing.compudiskett.com.pe",
    methods:['GET','POST'],
    credentials:true,
    /////sin esto el navegador le oculta a la pantalla el nombre del archivo de los reportes
    exposedHeaders:['Content-Disposition']
}

module.exports=corhabilitaciones;