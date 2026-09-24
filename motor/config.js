// Lee las claves de un archivo .env que no entra en git.
const fs = require('fs');
const path = require('path');

function cargar() {
  const archivo = path.join(__dirname, '..', '.env');
  const valores = {};
  if (fs.existsSync(archivo)) {
    for (const linea of fs.readFileSync(archivo, 'utf8').split('\n')) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith('#')) continue;
      const corte = limpia.indexOf('=');
      if (corte < 1) continue;
      valores[limpia.slice(0, corte).trim()] =
        limpia.slice(corte + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return {
    claveGoogle: process.env.CLAVE_GOOGLE || valores.CLAVE_GOOGLE || null,
    claveClaude: process.env.ANTHROPIC_API_KEY || valores.ANTHROPIC_API_KEY || null
  };
}

module.exports = { cargar };
