// Analiza perfiles de Instagram y TikTok con lo que sus paginas publicas entregan.
const U = require('./util');

const RUBRO = /(inmobiliari|propiedad|apartament|casa|terreno|local|oficina|alquiler|arriendo|venta|vender|comprar|bienes ra[ií]ces|realty|realtor|corredor|asesor)/i;
const LUGAR = /(caracas|valencia|maracaibo|barquisimeto|maracay|m[eé]rida|puerto la cruz|margarita|barcelona|matur[ií]n|lecher[ií]a|venezuela|miranda|zulia|carabobo|anzo[aá]tegui|aragua|lara|ccs|vzla)/i;
const LLAMADA = /(whatsapp|wa\.me|escr[ií]be|cont[aá]ct|link|enlace|abajo|dm|mensaje|cita|📲|📞|👇|🔗)/i;

const usuarioDe = (t) => {
  const m = String(t).match(/(?:instagram\.com|tiktok\.com)\/@?([A-Za-z0-9._-]+)/i);
  if (m) return m[1];
  return String(t).replace(/^@/, '').trim();
};

const mil = (n) => (n == null ? '0' : Number(n).toLocaleString('es-VE'));

const num = (t) => {
  if (!t) return null;
  const m = String(t).replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return null;
  const base = parseFloat(m[1]);
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1;
  return Math.round(base * mult);
};

// ---------------------------------------------------------------- Instagram
async function analizarInstagram(entrada) {
  const usuario = usuarioDe(entrada);
  // En ingles porque los numeros vienen en formato "104M Followers, 4,931 Posts".
  // En espanol usa el punto como separador de miles y se leen mal.
  const r = await U.traer('https://www.instagram.com/' + usuario + '/', {
    agente: U.AGENTE_BUSCADOR,
    idioma: 'en-US,en;q=0.9'
  });

  if (!r.ok || !r.html) {
    const e = new Error('Instagram no nos dejó entrar a ese perfil. Puede estar privado, no existir, o nos cerró la puerta esta vez.');
    e.amable = true;
    throw e;
  }

  const desc = U.meta(r.html, 'og:description') || '';
  // "104M Followers, 95 Following, 4,931 Posts". Si vuelve en otro idioma,
  // el segundo patron agarra los tres numeros igual.
  const cifras =
    desc.match(/([\d.,KMB]+)\s*Followers?,\s*([\d.,KMB]+)\s*Following,\s*([\d.,KMB]+)\s*Posts?/i) ||
    desc.match(/^\s*([\d.,\s]*[\d][\s]*[KMB]?)\s*\S+,\s*([\d.,\s]*[\d][\s]*[KMB]?)\s*\S+,\s*([\d.,\s]*[\d][\s]*[KMB]?)\s*\S+/i);
  const seguidores = cifras ? num(cifras[1]) : null;
  const siguiendo = cifras ? num(cifras[2]) : null;
  const publicaciones = cifras ? num(cifras[3]) : null;

  const bio = U.desescapar(((r.html.match(/"biography":"((?:[^"\\]|\\.)*)"/) || [])[1] || '')).replace(/\\n/g, ' ').trim();
  const nombre = U.desescapar(((r.html.match(/"full_name":"((?:[^"\\]|\\.)*)"/) || [])[1] || '')).trim();
  const enlace = U.desescapar(((r.html.match(/"external_url":"((?:[^"\\]|\\.)*)"/) || [])[1] || '')).trim();
  const verificado = /"is_verified":true/.test(r.html);
  const foto = /og:image/.test(r.html);

  if (!cifras && !bio && !nombre) {
    const e = new Error('Ese perfil de Instagram no soltó ningún dato. Suele pasar si es privado o si el nombre de usuario está mal escrito.');
    e.amable = true;
    throw e;
  }

  return {
    tipo: 'instagram',
    destino: 'instagram.com/' + usuario,
    pasos: pasosDePerfil({
      red: 'Instagram', nombre, bio, enlace, foto, verificado,
      seguidores, siguiendo, publicaciones, publicaLabel: 'publicaciones',
      // Instagram no entrega el enlace del perfil a nadie de fuera.
      // Antes que calificarlo mal sin saber, ese paso no se muestra.
      enlaceVisible: false
    })
  };
}

// ------------------------------------------------------------------- TikTok
async function analizarTikTok(entrada) {
  const usuario = usuarioDe(entrada);
  const r = await U.traer('https://www.tiktok.com/@' + usuario);

  if (!r.ok || !r.html) {
    const e = new Error('TikTok no nos dejó entrar a ese perfil. Revisa el nombre de usuario.');
    e.amable = true;
    throw e;
  }

  const saca = (clave) => {
    const m = r.html.match(new RegExp('"' + clave + '":\\s*"?((?:[^",\\\\]|\\\\.)*)"?[,}]'));
    return m ? U.desescapar(m[1]) : '';
  };

  const seguidores = Number((r.html.match(/"followerCount":(\d+)/) || [])[1] || 0) || null;
  const siguiendo = Number((r.html.match(/"followingCount":(\d+)/) || [])[1] || 0) || null;
  const videos = Number((r.html.match(/"videoCount":(\d+)/) || [])[1] || 0) || null;
  const nombre = saca('nickname');
  const bio = saca('signature').replace(/\\n/g, ' ').trim();
  const enlace = saca('bioLink') || ((r.html.match(/"link":"((?:[^"\\]|\\.)*)"/) || [])[1] || '');
  const verificado = /"verified":true/.test(r.html);

  if (!seguidores && !nombre) {
    const e = new Error('Ese perfil de TikTok no soltó ningún dato. Revisa que el usuario esté bien escrito.');
    e.amable = true;
    throw e;
  }

  return {
    tipo: 'tiktok',
    destino: 'tiktok.com/@' + usuario,
    pasos: pasosDePerfil({
      red: 'TikTok', nombre, bio, enlace, foto: true, verificado,
      seguidores, siguiendo, publicaciones: videos, publicaLabel: 'videos',
      enlaceVisible: true
    })
  };
}

// ------------------------------------------- los cuatro pasos de un perfil
function pasosDePerfil(p) {
  const bioLarga = (p.bio || '').length;
  const proporcion = p.seguidores && p.siguiendo ? p.seguidores / Math.max(1, p.siguiendo) : null;

  const pasos = [
    {
      corto: 'Escaparate',
      titulo: 'Tu escaparate',
      sub: 'Lo que ve alguien antes de decidir si te sigue',
      chequeos: ['Mirando la foto de perfil', 'Leyendo el nombre', 'Comprobando si estás verificado'],
      ...U.calificar([
        {
          ok: p.foto, peso: 3,
          bien: { t: 'Tienes foto de perfil', d: 'Es lo primero que se ve en cualquier lista.' },
          mal: { t: 'No tienes foto de perfil', d: 'Un perfil sin foto parece abandonado. Pon tu cara o tu logo.' }
        },
        {
          ok: !!p.nombre && p.nombre.length > 2, peso: 2,
          bien: { t: 'Tienes nombre puesto', d: 'Apareces como "' + p.nombre + '".' },
          mal: { t: 'No tienes nombre puesto', d: 'El campo del nombre también se busca. Pon tu nombre y a qué te dedicas.' }
        },
        {
          ok: RUBRO.test(p.nombre || ''), peso: 3,
          bien: { t: 'El nombre dice a qué te dedicas', d: 'Quien te busca por oficio te encuentra.' },
          mal: { t: 'El nombre no dice a qué te dedicas', d: 'En ' + p.red + ' el nombre se busca igual que el usuario. Escribe "Tu Nombre · Inmobiliaria" en vez de solo tu nombre.' }
        },
        {
          ok: p.verificado, peso: 1,
          bien: { t: 'Estás verificado', d: 'La palomita ayuda, aunque no es lo principal.' },
          mal: null
        }
      ])
    },
    {
      corto: 'Biografía',
      titulo: 'Tu biografía',
      sub: 'Las dos líneas que deciden si te escriben o siguen bajando',
      chequeos: ['Leyendo la biografía', 'Buscando qué haces y dónde', 'Buscando una invitación a escribirte'],
      ...U.calificar([
        {
          ok: bioLarga > 15, peso: 3,
          bien: { t: 'Tienes biografía escrita', d: '"' + (p.bio || '').slice(0, 90) + '"' },
          mal: { t: bioLarga === 0 ? 'Tu biografía está vacía' : 'Tu biografía es muy corta', d: 'Es el único espacio donde puedes decir quién eres. Tienes ciento cincuenta caracteres y los estás regalando.' }
        },
        {
          ok: RUBRO.test(p.bio || ''), peso: 3,
          bien: { t: 'Dices a qué te dedicas', d: 'Quien entra entiende en qué andas sin tener que deducirlo.' },
          mal: { t: 'No dices a qué te dedicas', d: 'La biografía no nombra propiedades, alquiler ni venta. Ponlo en la primera línea, es lo único que se lee completo.' }
        },
        {
          ok: LUGAR.test(p.bio || ''), peso: 3,
          bien: { t: 'Dices dónde trabajas', d: 'La zona aparece en la biografía. Eso filtra a quien no te sirve y atrae a quien sí.' },
          mal: { t: 'No dices dónde trabajas', d: 'Nadie busca un corredor a secas, busca uno de su ciudad. Ponle la zona a la biografía.' }
        },
        {
          ok: LLAMADA.test(p.bio || ''), peso: 2,
          bien: { t: 'Invitas a escribirte', d: 'La biografía dice qué hacer, no solo quién eres.' },
          mal: { t: 'No invitas a nada', d: 'Cierra la biografía diciendo qué quieres que hagan: "Escríbeme por WhatsApp" con la flecha al enlace.' }
        }
      ])
    },
    p.enlaceVisible === false ? null : {
      corto: 'Enlace',
      titulo: 'Tu enlace',
      sub: 'El único sitio donde te pueden sacar de la red social',
      chequeos: ['Buscando el enlace del perfil', 'Viendo a dónde lleva'],
      ...U.calificar([
        {
          ok: !!p.enlace, peso: 5,
          bien: { t: 'Tienes enlace en el perfil', d: 'Lleva a ' + String(p.enlace).replace(/^https?:\/\//, '').slice(0, 60) + '.' },
          mal: { t: 'No tienes enlace en el perfil', d: 'Es el único clic que ' + p.red + ' te regala. Pon ahí tu WhatsApp directo aunque no tengas página.' }
        },
        {
          ok: /wa\.me|whatsapp|linktr|beacons|bio\.link/i.test(p.enlace || ''), peso: 2,
          bien: { t: 'El enlace lleva a contactarte', d: 'Sin vueltas, va directo a la conversación.' },
          mal: p.enlace
            ? { t: 'El enlace no lleva a escribirte', d: 'Lleva a una página. Mejor que lleve directo a tu WhatsApp, o a un sitio donde el botón de escribir esté arriba.' }
            : null
        }
      ])
    },
    {
      corto: 'Actividad',
      titulo: 'Qué tan vivo se ve',
      sub: 'Un perfil parado da tan mala espina como una oficina cerrada',
      chequeos: ['Contando ' + p.publicaLabel, 'Mirando seguidores', 'Comparando a quién sigues'],
      ...U.calificar([
        (p.publicaciones === null && p.seguidores === null) ? {
          ok: false, peso: 1,
          mal: { t: 'No pudimos ver tus números', d: p.red + ' no nos soltó los seguidores ni las publicaciones esta vez. Vuelve a intentarlo en un rato.' }
        } : null,
        p.publicaciones !== null ? {
          ok: p.publicaciones >= 12, peso: 4,
          bien: { t: 'Tienes ' + mil(p.publicaciones) + ' ' + p.publicaLabel, d: 'Hay material suficiente para que alguien se quede mirando.' },
          mal: { t: 'Solo tienes ' + mil(p.publicaciones) + ' ' + p.publicaLabel, d: 'Un perfil con tan poco parece recién abierto. Sube una propiedad al día durante dos semanas y cambia la cara.' }
        } : null,
        p.seguidores !== null ? {
          ok: p.seguidores >= 300, peso: 2,
          bien: { t: 'Tienes ' + mil(p.seguidores) + ' seguidores', d: 'Hay gente mirando lo que publicas.' },
          mal: { t: 'Tienes ' + mil(p.seguidores) + ' seguidores', d: 'Todavía es poca gente. Publicar solo no basta, hay que meterse en los comentarios de tu zona.' }
        } : null,
        proporcion !== null ? {
          ok: proporcion >= 1, peso: 2,
          bien: { t: 'Te siguen más de los que sigues', d: 'Eso se lee como cuenta con algo que decir.' },
          mal: { t: 'Sigues a más gente de la que te sigue', d: 'Sigues a ' + mil(p.siguiendo) + ' y te siguen ' + mil(p.seguidores) + '. Se nota, y da sensación de cuenta nueva.' }
        } : null
      ])
    }
  ];

  return pasos.filter(Boolean);
}

module.exports = { analizarInstagram, analizarTikTok };
