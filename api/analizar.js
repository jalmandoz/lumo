// Funcion de Vercel: recibe la direccion y devuelve el analisis.
const { analizarWeb } = require('../motor/web');
const { analizarInstagram, analizarTikTok } = require('../motor/redes');

function reconocer(entrada) {
  const t = String(entrada).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  if (t.startsWith('instagram.com/') || t.startsWith('ig.me/')) return 'instagram';
  if (t.startsWith('tiktok.com/')) return 'tiktok';
  if (t.startsWith('facebook.com/') || t.startsWith('fb.com/')) return 'facebook';
  if (t.startsWith('@')) return 'instagram';
  return 'web';
}

async function analizar(entrada) {
  const tipo = reconocer(entrada);
  if (tipo === 'facebook') {
    const e = new Error('Facebook no deja mirar sus páginas desde fuera, nos cierra la puerta. Prueba con tu Instagram, tu TikTok o tu página web.');
    e.amable = true;
    throw e;
  }
  if (tipo === 'instagram') return analizarInstagram(entrada);
  if (tipo === 'tiktok') return analizarTikTok(entrada);
  return analizarWeb(entrada);
}

const media = (pasos) => Math.round(pasos.reduce((a, p) => a + p.puntaje, 0) / pasos.length);

module.exports = async (pedido, respuesta) => {
  const url = new URL(pedido.url, 'http://localhost');
  const destino = (url.searchParams.get('destino') || '').trim();

  respuesta.setHeader('Content-Type', 'application/json; charset=utf-8');
  respuesta.setHeader('Cache-Control', 'no-store');

  if (!destino) {
    respuesta.status(400).end(JSON.stringify({ error: 'Nos faltó saber qué revisar.' }));
    return;
  }

  const arranque = Date.now();
  try {
    const r = await analizar(destino);
    r.total = media(r.pasos);
    r.ms = Date.now() - arranque;
    respuesta.status(200).end(JSON.stringify(r));
  } catch (e) {
    const mensaje = e.amable
      ? e.message
      : 'Algo se nos atravesó revisando eso. Inténtalo otra vez en un momento.';
    console.log('[falla]', destino, '·', e.message);
    respuesta.status(e.amable ? 422 : 500).end(JSON.stringify({ error: mensaje }));
  }
};
