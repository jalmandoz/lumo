// Analiza una pagina web de verdad: la descarga y la mide.
const U = require('./util');
const { velocidadDeGoogle } = require('./velocidad');
const { juicioDeClaude } = require('./juicio');

const PALABRAS_RUBRO = /(inmobiliari|propiedad|apartament|casa|terreno|local|oficina|alquiler|arriendo|venta|vender|comprar|bienes ra[ií]ces|realty|realtor|corredor)/i;
const PALABRAS_LUGAR = /(caracas|valencia|maracaibo|barquisimeto|maracay|m[eé]rida|puerto la cruz|margarita|barcelona|maturin|lechería|venezuela|miranda|zulia|carabobo|anzo[aá]tegui|aragua|lara)/i;
// Titulares que no dicen nada. Los ve cualquiera y sigue de largo.
const TITULAR_VACIO = /^(bienvenid[oa]s?|welcome|inicio|home|hola|nuestra? (web|p[aá]gina|sitio)|p[aá]gina (web|principal)|bienvenid[oa]s? a (nuestr[oa] )?(web|p[aá]gina|sitio))\b/i;

// Frases de relleno que suenan bien y no dicen nada.
const RELLENO = /(calidad,? (confianza|compromiso|servicio)|l[ií]deres en el mercado|tu mejor opci[oó]n|la mejor opci[oó]n|soluciones integrales|excelencia|compromiso y dedicaci[oó]n|a[ñn]os de experiencia en el mercado|nos caracterizamos|somos una empresa (dedicada|comprometida|l[ií]der))/i;

// Titulos que quedaron como los dejo la plantilla.
const TITULO_PLANTILLA = /^(home|inicio|untitled|sin t[ií]tulo|documento sin t[ií]tulo|mi sitio|my site|sitio web|p[aá]gina web|just another wordpress site|new page|nueva p[aá]gina)$/i;

const PALABRAS_NOSOTROS = /(qui[eé]nes somos|sobre nosotros|nuestra historia|acerca de|conoc[eé]nos|nuestro equipo|about)/i;
const PALABRAS_TESTIMONIO = /(testimoni|opiniones|rese[ñn]as|lo que dicen|clientes satisfechos|recomendaci[oó]n)/i;

async function analizarWeb(destino) {
  const url = destino.startsWith('http') ? destino : 'https://' + destino;
  const r = await U.traer(url);

  if (!r.ok || !r.html) {
    const err = new Error(
      r.estado === 0
        ? 'No pudimos entrar a esa dirección. Revisa que esté bien escrita y que la página esté en pie.'
        : 'La página respondió con un error ' + r.estado + '. Puede estar caída o bloqueando visitas.');
    err.amable = true;
    throw err;
  }

  const html = r.html;
  const texto = U.quitarEtiquetas(html);
  const esHttps = r.url.startsWith('https://');

  // ---------- inventario de imagenes ----------
  const fuentes = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
  const imagenes = [...new Set(fuentes.map(s => U.absoluta(s, r.url)).filter(Boolean))]
    .filter(u => !/^data:/.test(u));
  const sinAlt = [...html.matchAll(/<img[^>]*>/gi)].filter(t => !/\salt\s*=\s*["'][^"']+["']/i.test(t[0])).length;
  const modernas = imagenes.filter(u => /\.(webp|avif)(\?|$)/i.test(u)).length;
  const perezosas = (html.match(/loading=["']lazy["']/gi) || []).length;

  const muestra = imagenes.slice(0, 12);
  const pesos = (await Promise.all(muestra.map(U.pesar))).filter(n => n !== null);
  const pesoMedio = pesos.length ? pesos.reduce((a, b) => a + b, 0) / pesos.length : null;
  const pesadas = pesos.filter(p => p > 500 * 1024).length;
  const pesoEstimado = pesoMedio ? pesoMedio * imagenes.length : null;

  // ---------- contacto ----------
  const whatsapp = /(wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com|whatsapp:\/\/)/i.test(html);
  const telefono = /href=["']tel:/i.test(html);
  const correo = /href=["']mailto:/i.test(html);
  const hayForm = /<form/i.test(html);
  const obligatorios = (html.match(/<(input|textarea|select)[^>]*\srequired/gi) || []).length;
  const campos = (html.match(/<(input|textarea|select)/gi) || []).length;

  // ---------- primera impresion ----------
  const titulo = (html.match(/<title[^>]*>([^<]*)/i) || [])[1];
  const tituloLimpio = U.desescapar(titulo || '').trim();
  const descripcion = U.meta(html, 'description');
  const h1 = U.desescapar(((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, '')).trim();
  // En paginas cortas el 40% se queda muy atras, por eso el minimo de 4000.
  const arriba = html.slice(0, Math.max(4000, Math.floor(html.length * 0.4)));
  const ctaArriba = /(wa\.me|api\.whatsapp|href=["']tel:)/i.test(arriba);

  // ---------- lo que se lee en la parte de arriba ----------
  const encabezado = texto.slice(0, 700);
  const titularVacio = TITULAR_VACIO.test((h1 || tituloLimpio).trim());
  const hayRelleno = RELLENO.test(encabezado);
  const tituloPlantilla = TITULO_PLANTILLA.test(tituloLimpio.trim());

  // grito: mas de la mitad de las letras en mayuscula
  const letras = encabezado.replace(/[^a-záéíóúñA-ZÁÉÍÓÚÑ]/g, '');
  const mayusculas = encabezado.replace(/[^A-ZÁÉÍÓÚÑ]/g, '').length;
  const grita = letras.length > 140 && mayusculas / letras.length > 0.6;

  // exclamaciones de mas
  const gritos = (encabezado.match(/!/g) || []).length;

  // la marca repetida hasta el cansancio
  const marca = (r.url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0] || '')
    .replace(/[^a-z0-9]/gi, '');
  const vecesMarca = marca.length > 3
    ? (encabezado.match(new RegExp(marca, 'gi')) || []).length
    : 0;

  // titular ni muy corto ni interminable
  const palabrasH1 = h1 ? h1.trim().split(/\s+/).length : 0;

  // ---------- confianza ----------
  const hayNosotros = PALABRAS_NOSOTROS.test(texto);
  const hayTestimonios = PALABRAS_TESTIMONIO.test(texto);
  const hayRedes = /(instagram\.com|facebook\.com|tiktok\.com)/i.test(html);
  const hayDireccion = /(direcci[oó]n|av\.|avenida|calle|piso|torre|centro comercial|c\.c\.)/i.test(texto) && texto.length > 400;

  // ---------- velocidad (medida de verdad) ----------
  const pesoHtml = r.bytes;
  const pesoTotal = pesoHtml + (pesoEstimado || 0);
  const comprimido = /gzip|br|deflate/i.test(r.cabeceras.get('content-encoding') || '');
  const movil = /<meta[^>]+name=["']viewport["']/i.test(html);

  const pasos = [
    {
      corto: 'Impresión',
      titulo: 'Primera impresión',
      sub: 'Lo que entiende alguien en los primeros tres segundos',
      chequeos: ['Leyendo el titular', 'Buscando qué ofreces', 'Viendo si hay algo que hacer'],
      ...U.calificar([
        {
          ok: !!tituloLimpio && tituloLimpio.length > 8,
          peso: 2,
          bien: { t: 'Tienes título', d: 'La pestaña del navegador dice "' + tituloLimpio.slice(0, 70) + '".' },
          mal: tituloLimpio
            ? { t: 'El título es demasiado corto', d: 'La pestaña dice "' + tituloLimpio + '". Eso es lo que lee Google. Dile lo que haces y dónde, te caben sesenta caracteres.' }
            : { t: 'La página no tiene título', d: 'Es lo primero que lee Google y lo que se ve en la pestaña. Hoy está vacío.' }
        },
        {
          ok: PALABRAS_RUBRO.test(tituloLimpio + ' ' + h1),
          peso: 3,
          bien: { t: 'Se entiende a qué te dedicas', d: 'El titular nombra lo que vendes, no solo el nombre de la empresa.' },
          mal: { t: 'No se entiende qué vendes', d: 'Ni el título ni el titular grande dicen que trabajas con propiedades. Cámbialo por lo que haces: "Apartamentos en venta y alquiler".' }
        },
        {
          ok: PALABRAS_LUGAR.test(tituloLimpio + ' ' + h1 + ' ' + (descripcion || '')),
          peso: 2,
          bien: { t: 'Dices dónde trabajas', d: 'La zona aparece arriba. Eso es lo primero que busca la gente.' },
          mal: { t: 'No dices dónde trabajas', d: 'Nadie busca "apartamentos" a secas, busca "apartamentos en Valencia". Ponle la ciudad al titular.' }
        },
        {
          ok: !!h1,
          peso: 2,
          bien: { t: 'Hay un titular grande', d: 'La página abre con un mensaje, no con un menú.' },
          mal: { t: 'No hay titular grande', d: 'La página abre sin decir nada. Falta una frase grande arriba del todo.' }
        },
        {
          ok: ctaArriba,
          peso: 3,
          bien: { t: 'Se puede contactar desde arriba', d: 'No hay que bajar para encontrarte.' },
          mal: { t: 'No hay nada que hacer al llegar', d: 'Falta un botón de WhatsApp arriba del todo. Hoy el visitante tiene que buscarte.' }
        },
        {
          ok: !!descripcion && descripcion.length > 40,
          peso: 1,
          bien: { t: 'Tienes descripción para Google', d: 'Es el texto que sale debajo de tu enlace en las búsquedas.' },
          mal: { t: 'Falta la descripción para Google', d: 'Google se inventa el texto que aparece bajo tu enlace. Escríbelo tú en dos líneas.' }
        },
        {
          ok: !titularVacio,
          peso: 3,
          bien: null,
          mal: { t: 'El titular no dice nada', d: 'Abre con "' + (h1 || tituloLimpio).slice(0, 45) + '". Eso lo puede poner cualquiera. Cambia ese espacio por lo que vendes y dónde.' }
        },
        {
          ok: !tituloPlantilla,
          peso: 2,
          bien: null,
          mal: { t: 'El título quedó como lo dejó la plantilla', d: 'La pestaña dice "' + tituloLimpio + '". Nadie cambió eso al montar la página, y Google lo lee tal cual.' }
        },
        {
          ok: !hayRelleno,
          peso: 2,
          bien: null,
          mal: { t: 'Arriba hay frases de relleno', d: 'Cosas como "calidad y compromiso" o "tu mejor opción" las dice todo el mundo. Cámbialas por un dato tuyo: cuántas propiedades manejas, cuántos años llevas, en qué zona.' }
        },
        {
          ok: !grita,
          peso: 2,
          bien: null,
          mal: { t: 'Está casi todo en mayúsculas', d: 'En pantalla las mayúsculas se leen como un grito y cuestan más de leer. Déjalas para el logo.' }
        },
        {
          ok: gritos <= 2,
          peso: 1,
          bien: null,
          mal: { t: 'Hay ' + gritos + ' signos de exclamación arriba', d: 'Cuando todo es urgente, nada lo es. Quita los que puedas y deja el mensaje solo.' }
        },
        vecesMarca ? {
          ok: vecesMarca <= 3,
          peso: 2,
          bien: null,
          mal: { t: 'Repites tu nombre ' + vecesMarca + ' veces', d: 'Quien llega ya sabe dónde está. Ese espacio sirve mejor para decirle qué puede conseguir contigo.' }
        } : null,
        h1 ? {
          ok: palabrasH1 >= 3 && palabrasH1 <= 14,
          peso: 2,
          bien: null,
          mal: palabrasH1 < 3
            ? { t: 'El titular es demasiado corto', d: '"' + h1 + '" no alcanza a decir nada. Con seis u ocho palabras cuentas qué vendes y dónde.' }
            : { t: 'El titular es demasiado largo', d: palabrasH1 + ' palabras. Nadie lee un párrafo de entrada. Déjalo en una línea que se lea de un golpe.' }
        } : null
      ])
    },
    {
      corto: 'Fotos',
      titulo: 'Las fotos',
      sub: 'Lo primero que mira alguien que busca una propiedad',
      chequeos: ['Contando las fotos', 'Pesando cada una', 'Revisando el formato'],
      ...U.calificar([
        {
          ok: imagenes.length >= 6,
          peso: 3,
          bien: { t: 'Tienes ' + imagenes.length + ' fotos', d: 'Hay material suficiente para que alguien se haga una idea.' },
          mal: { t: imagenes.length === 0 ? 'No encontramos ni una foto' : 'Solo hay ' + imagenes.length + ' foto' + (imagenes.length === 1 ? '' : 's'), d: 'Con menos de seis la gente ni entra. Sube fachada, sala, cocina, cuartos, baño y vista.' }
        },
        pesoMedio ? {
          ok: pesoMedio < 300 * 1024,
          peso: 3,
          bien: { t: 'Las fotos pesan bien', d: 'Promedio de ' + U.kb(pesoMedio) + ' kilobytes cada una. Cargan rápido hasta con datos móviles.' },
          mal: { t: 'Las fotos pesan demasiado', d: 'Promedio de ' + U.kb(pesoMedio) + ' kilobytes' + (pesadas ? ', y ' + pesadas + ' pasan de medio mega' : '') + '. Bájalas de tamaño antes de subirlas.' }
        } : null,
        {
          ok: imagenes.length > 0 && modernas / imagenes.length > 0.3,
          peso: 2,
          bien: { t: 'Usas formatos modernos', d: 'Las fotos en webp pesan la mitad y se ven igual.' },
          mal: { t: 'Las fotos están en formato viejo', d: 'Pasarlas a webp les quita la mitad del peso sin perder calidad. Es el arreglo más barato que tienes.' }
        },
        {
          ok: imagenes.length < 8 || perezosas > 0,
          peso: 2,
          bien: { t: 'Las fotos cargan a medida que bajas', d: 'No se descarga todo de golpe al abrir.' },
          mal: { t: 'Se descargan todas las fotos de golpe', d: 'Con ' + imagenes.length + ' fotos cargando a la vez, la página tarda aunque el visitante solo vea las tres primeras.' }
        },
        {
          ok: sinAlt === 0,
          peso: 1,
          bien: { t: 'Las fotos están descritas', d: 'Google entiende qué hay en cada una y te las muestra en imágenes.' },
          mal: { t: sinAlt + ' fotos sin descripción', d: 'Google no sabe qué hay en ellas, así que no las muestra en su buscador de imágenes.' }
        }
      ])
    },
    {
      corto: 'Contacto',
      titulo: 'Cómo te contactan',
      sub: 'El camino entre que les gusta algo y que te escriben',
      chequeos: ['Buscando tu WhatsApp', 'Revisando el formulario', 'Contando los campos'],
      ...U.calificar([
        {
          ok: whatsapp,
          peso: 4,
          bien: { t: 'Tienes WhatsApp en la página', d: 'Es por donde escribe casi todo el mundo.' },
          mal: { t: 'No hay WhatsApp', d: 'Es el único canal que la gente usa de verdad. Pon un botón con el número y un mensaje ya escrito.' }
        },
        {
          ok: telefono,
          peso: 2,
          bien: { t: 'El teléfono se puede tocar', d: 'Desde el móvil marca solo, no hay que copiarlo.' },
          mal: { t: 'El teléfono no se puede tocar', d: 'Si está escrito como texto, desde el móvil hay que copiarlo a mano. La mitad no lo hace.' }
        },
        {
          ok: !hayForm || obligatorios <= 3,
          peso: 3,
          bien: hayForm
            ? { t: 'El formulario es corto', d: obligatorios + ' campos obligatorios. Así sí lo llenan.' }
            : { t: 'No dependes de un formulario', d: 'Mejor así, los formularios largos espantan.' },
          mal: { t: 'El formulario pide demasiado', d: obligatorios + ' campos obligatorios de ' + campos + '. Con nombre y teléfono basta, el resto lo preguntas tú después.' }
        },
        {
          ok: correo,
          peso: 1,
          bien: { t: 'También hay correo', d: 'Da una salida a quien no usa WhatsApp.' },
          mal: { t: 'No hay correo', d: 'No es urgente, pero algunos clientes de empresa solo escriben por ahí.' }
        }
      ])
    },
    {
      corto: 'Velocidad',
      titulo: 'Qué tan rápido abre',
      sub: 'Cada segundo de más es gente que se va',
      chequeos: ['Cronometrando la respuesta', 'Pesando la página entera', 'Probando en teléfono'],
      ...U.calificar([
        {
          ok: r.ms < 1200,
          peso: 3,
          bien: { t: 'El servidor responde rápido', d: 'Tardó ' + (r.ms / 1000).toFixed(1).replace('.', ',') + ' segundos en contestar.' },
          mal: { t: 'El servidor tarda en contestar', d: 'Tardó ' + (r.ms / 1000).toFixed(1).replace('.', ',') + ' segundos solo en responder, antes de cargar nada. Eso es el alojamiento.' }
        },
        pesoEstimado ? {
          ok: pesoTotal < 3 * 1048576,
          peso: 4,
          bien: { t: 'La página pesa poco', d: 'Alrededor de ' + U.mb(pesoTotal) + ' megas en total. Abre bien hasta con mala señal.' },
          mal: { t: 'La página pesa ' + U.mb(pesoTotal) + ' megas', d: 'Con datos móviles eso son varios segundos de espera. Casi todo son las fotos sin comprimir.' }
        } : null,
        {
          ok: pesoHtml < 150 * 1024,
          peso: 2,
          bien: { t: 'El código está ligero', d: U.kb(pesoHtml) + ' kilobytes de página.' },
          mal: { t: 'El código está pesado', d: U.kb(pesoHtml) + ' kilobytes solo de texto, sin contar fotos. Suele ser plantilla de más.' }
        },
        {
          ok: comprimido,
          peso: 2,
          bien: { t: 'El servidor comprime lo que envía', d: 'Viaja menos por la red.' },
          mal: { t: 'El servidor no comprime', d: 'Activar la compresión es gratis y quita un tercio del peso. Lo hace quien te lleva el alojamiento.' }
        },
        {
          ok: movil,
          peso: 3,
          bien: { t: 'Está preparada para teléfono', d: 'Se adapta a la pantalla.' },
          mal: { t: 'No está preparada para teléfono', d: 'Falta la instrucción que le dice al móvil cómo mostrarla. Se ve diminuta y hay que hacer zoom.' }
        }
      ])
    },
    {
      corto: 'Confianza',
      titulo: 'Si dan ganas de escribirte',
      sub: 'Nadie llama a una página que no sabe de quién es',
      chequeos: ['Comprobando el candado', 'Buscando quién está detrás', 'Buscando clientes que hablen'],
      ...U.calificar([
        {
          ok: esHttps,
          peso: 4,
          bien: { t: 'La página es segura', d: 'Tiene candado, el navegador no asusta a nadie.' },
          mal: { t: 'La página no tiene candado', d: 'Chrome le avisa al visitante que tu sitio "no es seguro" antes de entrar. Es lo primero que hay que arreglar.' }
        },
        {
          ok: hayNosotros,
          peso: 3,
          bien: { t: 'Se sabe quién eres', d: 'Hay una página contando quién está detrás.' },
          mal: { t: 'No se sabe quién eres', d: 'No hay foto ni nombre ni años de oficio. Pon una página de "quién soy" con tu cara, cambia más de lo que crees.' }
        },
        {
          ok: hayTestimonios,
          peso: 3,
          bien: { t: 'Hay clientes que te recomiendan', d: 'Eso vale más que cualquier cosa que digas tú.' },
          mal: { t: 'Ningún cliente te recomienda ahí', d: 'Tienes clientes contentos y no aparecen. Tres frases con nombre y foto cambian todo.' }
        },
        {
          ok: hayRedes,
          peso: 2,
          bien: { t: 'Enlazas tus redes', d: 'Quien duda se va a mirarlas, y eso juega a tu favor.' },
          mal: { t: 'No enlazas tus redes', d: 'Tus redes son la prueba de que estás activo. Ponlas visibles.' }
        },
        {
          ok: hayDireccion,
          peso: 1,
          bien: { t: 'Dices dónde estás', d: 'Una dirección física tranquiliza.' },
          mal: { t: 'No dices dónde estás', d: 'Aunque trabajes sin oficina, nombrar tu zona da confianza.' }
        }
      ])
    }
  ];

  // Si hay claves puestas, dos pasos se reemplazan por la version buena.
  // Google mide la velocidad de verdad y Claude juzga si la pagina se entiende.
  const [deGoogle, deClaude] = await Promise.all([
    velocidadDeGoogle(r.url),
    juicioDeClaude({
      url: r.url,
      titulo: tituloLimpio,
      descripcion,
      h1,
      ctaArriba,
      texto: texto.slice(0, 7000)
    })
  ]);

  if (deClaude) pasos[0] = deClaude;
  if (deGoogle) pasos[3] = deGoogle;

  return {
    tipo: 'web',
    destino: r.url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    pasos,
    motor: {
      impresion: deClaude ? 'claude' : 'reglas',
      velocidad: deGoogle ? 'google' : 'medicion propia'
    }
  };
}

module.exports = { analizarWeb };
