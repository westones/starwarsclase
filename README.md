# Galaxia Star Wars

Sitio web estático, temático y accesible sobre el universo Star Wars. Adapta el proyecto de
clase original (una web de Pokémon) a una nueva temática, conservando la estructura de tres
columnas y añadiendo Bootstrap, Tailwind, jQuery, multimedia, animación en `<canvas>` y
soporte de lectura en voz alta para el lector de pantalla.

Es un trabajo educativo sin ánimo de lucro. Star Wars y todos los nombres relacionados son
marcas de Disney/Lucasfilm; este proyecto no está afiliado ni respaldado por ellos.

## Descripción

- Ocho páginas HTML estáticas con una cabecera, una navegación lateral, contenido principal,
  panel lateral derecho, lector de voz flotante y pie de página comunes.
- Tema oscuro con acento dorado, gráficos vectoriales originales y datos de personajes
  obtenidos de la API pública SWAPI.
- Objetivo de accesibilidad: WCAG 2.1 nivel AA (WAI-AA), declarado en la propia web.

## Cómo ejecutar

El sitio es estático y no requiere compilación. Hay dos formas de abrirlo:

1. **Live Server (recomendado).** Abre la carpeta del proyecto con cualquier servidor
   estático, por ejemplo la extensión Live Server de VS Code, y visita `index.html`.
   Servir por HTTP permite que los subtítulos WebVTT del vídeo se carguen correctamente.
2. **Doble clic en `index.html` (`file://`).** Funciona en general, pero con `file://` el
   navegador puede bloquear la carga de los subtítulos WebVTT por restricciones de origen.
   El resto de la página se ve con normalidad.

Todos los recursos externos (Bootstrap, Tailwind y jQuery) se cargan por CDN, por lo que se
necesita conexión a internet para el estilo base y las interacciones. Las páginas llevan
CSS propio, de modo que la estructura sigue siendo legible aunque un CDN no esté disponible.

## Estructura de carpetas

```
.
├── index.html                 Inicio
├── personajes.html            Personajes (SWAPI)
├── facciones.html             Facciones, canvas, sable y vídeo
├── historia.html              Historia y cronología
├── enlaces.html               Enlaces de interés
├── accesibilidad.html         Declaración de accesibilidad
├── storyboard.html            Storyboard y mapa de pantallas
├── presentacion.html          Presentación de 10 diapositivas
├── css/
│   └── style.css              Tema, shell y estilos con alcance de página
├── js/
│   ├── api.js                 Acceso a SWAPI y utilidades de datos
│   ├── dom.js                 Helpers de DOM, escapado y avatares SVG
│   ├── script.js              Lógica de la página Personajes (búsqueda y modal)
│   ├── canvas.js              Animación del campo de estrellas
│   ├── lector.js              Lector de voz (Web Speech API)
│   ├── navegacion.js          Comportamiento global de jQuery
│   └── presentacion.js        Lógica del mazo de diapositivas (solo Presentación)
├── img/
│   ├── favicon.svg
│   ├── portada-saga.svg
│   ├── starfield.svg
│   ├── video-poster.svg
│   ├── certificado-wai-aa.svg Distintivo de conformidad WCAG 2.1 AA
│   ├── emblemas/              Emblemas de facciones (SVG originales)
│   └── enlaces/               Distintivos de los enlaces (SVG originales)
├── audio/
│   ├── ambient.mp3            Audio ambiental sintetizado
│   └── sable.mp3              Sonido del selector de sable
├── video/
│   ├── intro.mp4
│   └── intro.es.vtt           Subtítulos en español
├── docs/                      Informes de accesibilidad (antes y después)
├── odd/tasks/star-wars-site.md Plan del proyecto
├── LICENSE                    GNU GPL v3.0
├── NOTICE                     Aviso de obra derivada y procedencia de recursos
└── README.md
```

## Stack

- **HTML5 semántico** con puntos de referencia (`header`, `nav`, `main`, `aside`, `footer`).
- **Bootstrap 5.3.3** por CDN: rejilla, modal, acordeón y botones.
- **Tailwind CSS 3.4** por CDN, con `preflight` desactivado para no interferir con el tema.
- **jQuery 3.7.1** por CDN para las interacciones.
- **CSS propio** (`css/style.css`) cargado en último lugar, con los tokens de diseño.
- **JavaScript propio** en `js/`, sin herramientas de compilación.

## Páginas

| Página | Contenido principal |
|--------|---------------------|
| `index.html` | Portada, resumen del sitio y accesos a las secciones. |
| `personajes.html` | Explorador de personajes con búsqueda en vivo y detalle en modal. |
| `facciones.html` | Facciones, filtro por alineación, selector de sable, canvas y vídeo. |
| `historia.html` | Cronología galáctica por eras, curiosidades y descripción del audio. |
| `enlaces.html` | Recursos externos recomendados (oficiales y comunitarios). |
| `accesibilidad.html` | Declaración de accesibilidad, compatibilidad y certificación. |
| `storyboard.html` | Diagramas de flujo accesibles y mapa de pantallas. |
| `presentacion.html` | Presentación de diez diapositivas navegable por teclado. |

## Elementos interactivos

Interacciones con **jQuery** (la mayoría en `js/navegacion.js`):

1. **Botón de música**: activa o detiene el audio ambiental de la cabecera.
2. **Volver arriba**: botón flotante que aparece al desplazarse.
3. **Selector de sable de luz**: cambia el acento de color del sitio y lo guarda en el
   navegador.
4. **Filtro de facciones por alineación** (luz, oscuridad, neutral).
5. **Botón de hiperespacio**: acelera la animación del campo de estrellas.
6. **Personaje del día**: rellena el panel lateral con datos de SWAPI.
7. **Buscador en vivo** y filtro por especie en Personajes.
8. **Mazo de diapositivas** con anuncios `aria-live` (solo en Presentación).

Componentes de **Bootstrap**:

- **Modal** de detalle de personaje.
- **Acordeón** de preguntas frecuentes en Facciones.
- **Rejilla** responsiva (contenedor y columnas) en varias páginas.
- **Botones** con estados de foco y desactivado.

## Multimedia

- **Imágenes**: ilustraciones, emblemas y distintivos en SVG original.
- **Audio**: pista ambiental sintetizada y sonido del sable.
- **Vídeo**: archivo propio con subtítulos WebVTT y transcripción, además de un vídeo
  incrustado de YouTube como recurso externo.
- **Canvas**: campo de estrellas animado en la página Facciones.

## Accesibilidad

El sitio incluye, entre otras medidas:

- Enlace de salto al contenido principal como primer elemento enfocable.
- Puntos de referencia y jerarquía de encabezados coherente.
- Texto alternativo en todas las imágenes y diagramas.
- Foco siempre visible (los contornos no se eliminan).
- Navegación completa por teclado, incluido el mazo de diapositivas (flechas, Inicio, Fin).
- Regiones `aria-live` que anuncian los cambios de estado.
- Lector de voz integrado (botones «Leer página» y «Detener»).
- Subtítulos y transcripción del vídeo propio.
- Respeto de `prefers-reduced-motion` para reducir animaciones.

### Cómo probar la accesibilidad

- **Teclado**: recorre la página con `Tab` / `Shift+Tab`; el foco debe verse en todo momento.
- **Enlace de salto**: pulsa `Tab` al cargar; aparece «Saltar al contenido principal».
- **Lector de voz**: usa «Leer página», pausa, reanuda y detén la lectura.
- **Auditoría automática** (requiere Node.js):
  ```bash
  npx pa11y --standard WCAG2AA index.html
  ```
- **apoyo**: el panel de Lighthouse o la extensión axe DevTools en Chrome.

## Informes de accesibilidad

Los resultados de la evaluación se guardan en la carpeta `docs/`:

- [`docs/informe-accesibilidad-antes.md`](docs/informe-accesibilidad-antes.md)
- [`docs/informe-accesibilidad-despues.md`](docs/informe-accesibilidad-despues.md)

Estos informes recogen los resultados de la auditoría antes y después de las correcciones.
Se generan como parte del proyecto y no se reproducen cifras aquí para evitar datos
desactualizados.

## Licencia y marcas

- Código publicado bajo la **Licencia Pública General de GNU v3.0**. Consulta
  [`LICENSE`](LICENSE).
- La procedencia del código y de los recursos se detalla en [`NOTICE`](NOTICE).
- **Aviso de marcas**: Star Wars y todos los nombres, personajes y logotipos relacionados
  son marcas registradas de Disney/Lucasfilm. Este sitio es un trabajo educativo sin ánimo de
  lucro y no está afiliado ni respaldado por Disney/Lucasfilm. No se distribuye arte ni audio
  de terceros.

## Créditos

- **Equipo Galaxia** (integrantes: completar nombres en la diapositiva de portada).
- Datos de personajes: [SWAPI](https://swapi.dev).
- Ilustraciones, emblemas, distintivos, audio y vídeo: recursos originales generados para el
  proyecto.

## Decisiones técnicas

- **Recursos originales**: se generaron SVG, audio y vídeo propios para no distribuir arte ni
  audio con derechos de terceros. Las marcas se usan solo con fines educativos.
- **Sin Figma**: el diseño se documenta en `storyboard.html` con diagramas SVG accesibles en
  lugar de un prototipo de diseño.
- **Datos de SWAPI**: la sección Personajes consume la API pública; se manejan los estados de
  carga y error para que el resto del sitio siga funcionando.
- **jQuery sin React**: cumple el requisito de interactividad sin introducir un paso de
  compilación, manteniendo el sitio completamente estático.

## Rúbrica: dónde se cumple cada criterio

| Criterio | Dónde se satisface |
|----------|--------------------|
| Estructura HTML5 y semántica | Todas las páginas; puntos de referencia en la cabecera, la navegación, `main`, los laterales y el pie. |
| Bootstrap 5 | Rejilla, modal (Personajes), acordeón (Facciones), botones; `bootstrap.bundle.min.js`. |
| Tailwind | `cdn.tailwindcss.com` con `preflight: false`; utilidades puntuales en el marcado. |
| jQuery / React | `jquery-3.7.1.min.js` y los módulos de `js/` (búsqueda, modal, filtros, sable, música, diapositivas). |
| Canvas | `js/canvas.js` y `<canvas id="fondo-estrellas">` en Facciones. |
| Multimedia (imagen, audio, vídeo) | SVG en `img/`, audio en `audio/`, vídeo con subtítulos en `video/`. |
| Lector de pantalla / voz | `js/lector.js` con los botones «Leer página» y «Detener» en todas las páginas. |
| Texto alternativo | `alt` significativo en todas las imágenes; diagramas SVG con `title`/`desc`. |
| Accesibilidad y teclado | Foco visible, enlace de salto, `aria-live`, navegación por teclado; `accesibilidad.html`. |
| Auditoría de accesibilidad | Informes en `docs/`; declaración y estado de conformidad en `accesibilidad.html`. |
| WAI-AA | Certificación declarada y distintivo `img/certificado-wai-aa.svg`. |
| Storyboard | `storyboard.html` con diagramas SVG y mapa de pantallas. |
| Presentación | `presentacion.html` + `js/presentacion.js` (10 diapositivas accesibles). |
| Licencia y obra derivada | `LICENSE` (GPL-3.0) y `NOTICE`. |
| Recursos originales | SVG, audio y vídeo generados para el proyecto; sin arte de terceros. |
