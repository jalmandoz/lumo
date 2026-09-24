# Lumo

Califica una página web o un perfil de redes y dice qué hay que mejorar.

## Arrancarlo

```
node servidor.js
```

Queda en http://localhost:4321

## Qué hay dentro

- `index.html` · toda la interfaz: carga, bienvenida y el análisis paso a paso
- `servidor.js` · sirve la página y atiende `/api/analizar?destino=...`
- `motor/web.js` · analiza páginas web
- `motor/redes.js` · analiza perfiles de Instagram y TikTok
- `motor/util.js` · piezas compartidas

## Qué mide de verdad

**Páginas web.** Descarga la página y la mide: título, descripción, titular, si hay
WhatsApp arriba, cuántas fotos hay y cuánto pesa cada una, el formato de las imágenes,
los campos del formulario, el tiempo de respuesta del servidor, si comprime, si está
preparada para teléfono, si tiene candado, si hay página de "quiénes somos" y si hay
testimonios.

**Instagram.** Foto de perfil, nombre, biografía, verificación, seguidores, seguidos y
publicaciones. Se pide en inglés porque en español los números vienen con el punto como
separador de miles y se leen mal.

**TikTok.** Lo mismo más el enlace del perfil.

**Facebook.** No se puede, devuelve error a cualquiera que no sea un navegador con sesión.

## Lo que no se puede ver

Instagram no entrega el enlace del perfil a nadie de fuera, así que ese paso no se muestra
en Instagram. Antes que calificarlo mal sin saber, no se pregunta.

Tampoco se ven las publicaciones en sí, ni sus fotos ni sus textos. Solo el escaparate.

## Las reglas de primera impresión

Sin la clave de Anthropic, este paso lo resuelven reglas. Revisan:

- Que haya título y que no sea el que dejó la plantilla ("Inicio", "Untitled", "Mi sitio")
- Que el título o el titular digan a qué te dedicas
- Que digan dónde trabajas
- Que el titular no sea un saludo vacío ("Bienvenidos a nuestra web")
- Que el titular tenga entre tres y catorce palabras
- Que haya forma de contactar desde arriba
- Que no haya frases de relleno ("calidad y compromiso", "líderes en el mercado")
- Que no esté todo en mayúsculas
- Que no haya más de dos signos de exclamación arriba
- Que no repitas el nombre de tu empresa más de tres veces
- Que haya descripción para Google

## Pendiente

- **Velocidad con Google.** La API de PageSpeed da el número oficial. Es gratis pero hace
  falta una clave de Google, sin tarjeta. Hoy la velocidad se mide aquí mismo: tiempo de
  respuesta, peso total y compresión.
- **Juicio de Claude.** "¿Se entiende este titular?" es un juicio, no un dato. Hoy se
  resuelve con reglas. Con una clave de Anthropic se puede pedir la opinión de verdad.
