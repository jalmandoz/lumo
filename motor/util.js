// Piezas compartidas por los analizadores.

const AGENTE_NAVEGADOR =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Instagram solo entrega los datos publicos del perfil a los buscadores.
// Es la misma pagina que Google indexa. Decision tomada por Jorge el 2026-09-24.
const AGENTE_BUSCADOR =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const TIEMPO_LIMITE = 15000;

async function traer(url, opciones = {}) {
  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), opciones.limite || TIEMPO_LIMITE);
  const arranque = Date.now();
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      signal: control.signal,
      headers: {
        'User-Agent': opciones.agente || AGENTE_NAVEGADOR,
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': opciones.idioma || 'es-VE,es;q=0.9,en;q=0.8'
      }
    });
    const cuerpo = opciones.soloCabecera ? '' : await r.text();
    return {
      ok: r.ok,
      estado: r.status,
      url: r.url,
      cabeceras: r.headers,
      html: cuerpo,
      bytes: cuerpo ? Buffer.byteLength(cuerpo) : Number(r.headers.get('content-length') || 0),
      ms: Date.now() - arranque
    };
  } catch (e) {
    return { ok: false, estado: 0, error: String(e.message || e), ms: Date.now() - arranque };
  } finally {
    clearTimeout(corte);
  }
}

// Peso real de una imagen, sin descargarla entera cuando se puede evitar.
async function pesar(url) {
  try {
    const control = new AbortController();
    const corte = setTimeout(() => control.abort(), 8000);
    const r = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: control.signal,
      headers: { 'User-Agent': AGENTE_NAVEGADOR }
    });
    clearTimeout(corte);
    const largo = Number(r.headers.get('content-length') || 0);
    return largo > 0 ? largo : null;
  } catch {
    return null;
  }
}

const quitarEtiquetas = (h) =>
  h.replace(/<script[\s\S]*?<\/script>/gi, ' ')
   .replace(/<style[\s\S]*?<\/style>/gi, ' ')
   .replace(/<[^>]+>/g, ' ')
   .replace(/&nbsp;/g, ' ')
   .replace(/\s+/g, ' ')
   .trim();

const meta = (html, nombre) => {
  const re = new RegExp(
    '<meta[^>]+(?:name|property)=["\']' + nombre + '["\'][^>]*content=["\']([^"\']*)',
    'i');
  const m = html.match(re);
  if (m) return desescapar(m[1]);
  const re2 = new RegExp(
    '<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:name|property)=["\']' + nombre + '["\']',
    'i');
  const m2 = html.match(re2);
  return m2 ? desescapar(m2[1]) : null;
};

const desescapar = (t) => (t || '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\\u[\dA-F]{4}/gi, (c) => String.fromCharCode(parseInt(c.slice(2), 16)));

const absoluta = (src, base) => {
  try { return new URL(src, base).href; } catch { return null; }
};

const kb = (b) => Math.round(b / 1024);
const mb = (b) => (b / 1048576).toFixed(1).replace('.', ',');

// Convierte una lista de comprobaciones en puntaje y hallazgos.
// Cada comprobacion: {ok, peso, bien:{t,d}, mal:{t,d}}
function calificar(comprobaciones) {
  const vivas = comprobaciones.filter(Boolean);
  const total = vivas.reduce((a, c) => a + c.peso, 0) || 1;
  const ganado = vivas.reduce((a, c) => a + (c.ok ? c.peso : 0), 0);
  const puntaje = Math.max(0, Math.min(100, Math.round((ganado / total) * 100)));

  const malos = vivas.filter(c => !c.ok && c.mal).sort((a, b) => b.peso - a.peso)
    .map(c => ({ bien: false, t: c.mal.t, d: c.mal.d }));
  const buenos = vivas.filter(c => c.ok && c.bien)
    .map(c => ({ bien: true, t: c.bien.t, d: c.bien.d }));

  // Primero lo que esta bien (maximo dos, para no tapar lo importante), luego lo que falta.
  return { puntaje, hallazgos: buenos.slice(0, 2).concat(malos.slice(0, 4)) };
}

module.exports = {
  AGENTE_NAVEGADOR, AGENTE_BUSCADOR,
  traer, pesar, quitarEtiquetas, meta, desescapar, absoluta, kb, mb, calificar
};
