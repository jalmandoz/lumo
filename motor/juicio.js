// "Se entiende esta pagina?" es un juicio, no un dato. Eso lo responde Claude.
// Sin clave, devuelve null y se usa la calificacion por reglas.
const Anthropic = require('@anthropic-ai/sdk');
const { z } = require('zod');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');
const { cargar } = require('./config');

const Veredicto = z.object({
  puntaje: z.number().int().min(0).max(100),
  hallazgos: z.array(z.object({
    bien: z.boolean(),
    t: z.string(),
    d: z.string()
  })).min(2).max(5)
});

const INSTRUCCIONES = `Eres Lumo. Revisas la página web de un corredor inmobiliario en Venezuela y le dices, sin rodeos, si se entiende qué vende y si dan ganas de escribirle.

Te fijas solo en la primera impresión: lo que capta alguien en los primeros tres segundos. No hables de velocidad, de fotos ni de seguridad, eso lo miden otros.

Califica de 0 a 100:
- 80 o más: se entiende al instante qué vende, dónde trabaja, y hay algo claro que hacer.
- 50 a 79: se entiende a medias, o falta la acción.
- menos de 50: hay que adivinar a qué se dedica.

Devuelve entre dos y cinco hallazgos. Empieza por lo que está bien si hay algo, sigue con lo que falta, y ordena lo que falta por lo que más le está costando clientes.

Cómo escribes:
- Español de Venezuela, cercano, de tú.
- Cero jerga técnica. Nada de "call to action", "above the fold" ni "conversión".
- Cero rayas largas. Usa comas y puntos.
- El título de cada hallazgo, menos de nueve palabras, dice qué pasa.
- La explicación, una o dos frases, dice qué hacer y por qué. Cita el texto real de la página cuando ayude.
- Nada de diminutivos, nada de relleno.`;

async function juicioDeClaude(datos) {
  const { claveClaude } = cargar();
  if (!claveClaude) return null;

  try {
    const cliente = new Anthropic({ apiKey: claveClaude });

    const respuesta = await cliente.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 8000,
      system: INSTRUCCIONES,
      output_config: {
        format: zodOutputFormat(Veredicto),
        effort: 'medium'
      },
      messages: [{
        role: 'user',
        content:
`Dirección: ${datos.url}

Título de la pestaña: ${datos.titulo || '(vacío)'}
Descripción para Google: ${datos.descripcion || '(vacía)'}
Titular grande de la página: ${datos.h1 || '(no hay)'}

¿Se puede contactar desde la parte de arriba? ${datos.ctaArriba ? 'sí' : 'no'}

Texto de la página tal como se lee:
${datos.texto}`
      }]
    });

    const v = respuesta.parsed_output;
    if (!v) return null;

    return {
      corto: 'Impresión',
      titulo: 'Primera impresión',
      sub: 'Lo que entiende alguien en los primeros tres segundos',
      chequeos: ['Leyendo tu página entera', 'Poniéndonos en los ojos de un cliente', 'Decidiendo si se entiende'],
      puntaje: v.puntaje,
      hallazgos: v.hallazgos,
      fuente: 'claude'
    };
  } catch (e) {
    console.log('[juicio] no se pudo:', e.message);
    return null;
  }
}

module.exports = { juicioDeClaude };
