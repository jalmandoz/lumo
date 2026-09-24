// Servidor de Lumo: sirve la pagina y analiza de verdad lo que le pidan.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { analizarWeb } = require('./motor/web');
const { analizarInstagram, analizarTikTok } = require('./motor/redes');

const PUERTO = process.env.PUERTO || 4321;
const RAIZ = path.join(__dirname, 'public');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

// Decide si lo que escribio el usuario es una web, un Instagram o un TikTok.
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

function media(pasos) {
  const suma = pasos.reduce((a, p) => a + p.puntaje, 0);
  return Math.round(suma / pasos.length);
}

const servidor = http.createServer(async (pedido, respuesta) => {
  const url = new URL(pedido.url, 'http://localhost');

  // ---------------- la interfaz pregunta por aqui ----------------
  if (url.pathname === '/api/analizar') {
    const destino = (url.searchParams.get('destino') || '').trim();
    respuesta.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (!destino) {
      respuesta.writeHead(400);
      return respuesta.end(JSON.stringify({ error: 'Nos faltó saber qué revisar.' }));
    }

    const arranque = Date.now();
    try {
      const r = await analizar(destino);
      r.total = media(r.pasos);
      r.ms = Date.now() - arranque;
      console.log('[ok]', r.tipo, r.destino, '·', r.total, 'puntos ·', r.ms + 'ms');
      respuesta.writeHead(200);
      return respuesta.end(JSON.stringify(r));
    } catch (e) {
      const mensaje = e.amable
        ? e.message
        : 'Algo se nos atravesó revisando eso. Inténtalo otra vez en un momento.';
      console.log('[falla]', destino, '·', e.message);
      respuesta.writeHead(e.amable ? 422 : 500);
      return respuesta.end(JSON.stringify({ error: mensaje }));
    }
  }

  // ---------------- archivos de la pagina ----------------
  let ruta = decodeURIComponent(url.pathname);
  if (ruta === '/' || ruta === '') ruta = '/index.html';
  const completa = path.join(RAIZ, path.normalize(ruta).replace(/^(\.\.[/\\])+/, ''));

  if (!completa.startsWith(RAIZ)) {
    respuesta.writeHead(403);
    return respuesta.end('Fuera de sitio');
  }

  fs.readFile(completa, (err, datos) => {
    if (err) {
      respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return respuesta.end('No encontrado');
    }
    respuesta.writeHead(200, {
      'Content-Type': TIPOS[path.extname(completa).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    respuesta.end(datos);
  });
});

servidor.listen(PUERTO, () => {
  console.log('Lumo en pie · http://localhost:' + PUERTO);
});
