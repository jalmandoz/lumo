// Velocidad oficial de Google (PageSpeed Insights). Necesita una clave gratuita.
// Sin clave, devuelve null y se usa la medicion propia.
const { cargar } = require('./config');

async function velocidadDeGoogle(url) {
  const { claveGoogle } = cargar();
  if (!claveGoogle) return null;

  const consulta = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  consulta.searchParams.set('url', url);
  consulta.searchParams.set('strategy', 'mobile');
  consulta.searchParams.set('category', 'performance');
  consulta.searchParams.set('key', claveGoogle);

  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), 60000);
  try {
    const r = await fetch(consulta, { signal: control.signal });
    const d = await r.json();
    if (d.error || !d.lighthouseResult) return null;

    const lh = d.lighthouseResult;
    const puntaje = Math.round(lh.categories.performance.score * 100);
    const dato = (clave) => {
      const a = lh.audits[clave];
      return a ? { valor: a.numericValue, texto: a.displayValue } : null;
    };

    const pintado = dato('first-contentful-paint');
    const grande = dato('largest-contentful-paint');
    const salto = dato('cumulative-layout-shift');
    const respuesta = dato('server-response-time');

    const hallazgos = [];
    const empuja = (bien, t, d) => hallazgos.push({ bien, t, d });

    if (grande) {
      const seg = (grande.valor / 1000).toFixed(1).replace('.', ',');
      grande.valor <= 2500
        ? empuja(true, 'Lo importante se ve rápido', 'Lo más grande de la pantalla aparece en ' + seg + ' segundos.')
        : empuja(false, 'Tarda ' + seg + ' segundos en verse', 'La mitad de la gente se va antes de los tres. Casi siempre son las fotos sin comprimir.');
    }
    if (pintado) {
      const seg = (pintado.valor / 1000).toFixed(1).replace('.', ',');
      pintado.valor <= 1800
        ? empuja(true, 'Se ve algo enseguida', 'El primer contenido aparece en ' + seg + ' segundos.')
        : empuja(false, 'La pantalla se queda en blanco ' + seg + ' segundos', 'Ese rato en blanco es donde la gente cierra la pestaña.');
    }
    if (salto) {
      salto.valor <= 0.1
        ? empuja(true, 'Nada se mueve mientras carga', 'El contenido no salta bajo el dedo.')
        : empuja(false, 'El contenido salta mientras carga', 'La gente va a tocar un botón y se le mueve. Suele ser por fotos sin medidas puestas.');
    }
    if (respuesta) {
      respuesta.valor <= 600
        ? empuja(true, 'El servidor responde rápido', respuesta.texto + ' en contestar.')
        : empuja(false, 'El servidor tarda en contestar', respuesta.texto + ' solo en responder, antes de cargar nada. Eso es el alojamiento.');
    }

    return {
      corto: 'Velocidad',
      titulo: 'Qué tan rápido abre',
      sub: 'Medido por Google, en teléfono, igual que cuando decide dónde mostrarte',
      chequeos: ['Pidiéndole la medición a Google', 'Cargando tu página en un teléfono', 'Cronometrando cada pieza'],
      puntaje,
      hallazgos: hallazgos.slice(0, 5),
      fuente: 'google'
    };
  } catch {
    return null;
  } finally {
    clearTimeout(corte);
  }
}

module.exports = { velocidadDeGoogle };
