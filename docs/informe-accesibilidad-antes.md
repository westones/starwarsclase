# Informe de accesibilidad — ANTES de las correcciones

- **Proyecto:** Star Wars Universe (adaptado del proyecto original *Pokémon's World*)
- **Herramientas:** axe-core 4.14.0 (motor WCAG 2.1 A/AA) vía puppeteer-core, sobre Chromium 153.0.8010.52 headless; validación cruzada con pa11y 8.0.0 (motores HTMLCS y axe)
- **Estándar evaluado:** WCAG 2.1 niveles A y AA (WAI-AA)
- **Método:** cada página servida por HTTP local (`http://127.0.0.1`) y auditada a 1400×2400 px tras el evento `networkidle` (se esperan 2,5 s para el contenido dinámico de SWAPI)
- **Fecha:** 2026-10-16
- **Estado auditado:** commit `28f3927` (sitio Star Wars completo, antes de la corrección)

---

## 1. Punto de partida: proyecto original (Pokémon)

Antes de la adaptación se auditó el proyecto original reutilizado, como línea base del material heredado:

| Página | Infracciones | Regla principal |
|---|---|---|
| index.html | 21 | `color-contrast` |
| historia.html | 5 | `color-contrast` |
| pokedex.html | 41 | `color-contrast` |
| tipos.html | 10 | `color-contrast` |
| enlaces.html | 11 | `color-contrast` |
| **TOTAL** | **88 nodos** | |

Además, las 5 páginas presentaban `no-autoplay-audio` (audio en reproducción automática sin control accesible) como incidencia a revisar. El proyecto original **no tenía lector de voz, ni enlace de salto, ni estilos de foco visibles**.

---

## 2. Sitio Star Wars — estado inicial (antes)

Tras la adaptación temática, la estructura ya era accesible (landmarks, `alt`, skip-link, foco visible, `aria-live`), por lo que las infracciones **reales** se redujeron drásticamente:

| Página | Infracciones | Reglas | Incompletos (*needs review*) |
|---|---|---|---|
| index.html | 0 | — | `aria-prohibited-attr` (1), `color-contrast` (9) |
| personajes.html | 0 | — | `color-contrast` (24) |
| facciones.html | 0 | — | `color-contrast` (4), `link-in-text-block` (1) |
| historia.html | 0 | — | `color-contrast` (4) |
| enlaces.html | **2** | `color-contrast` | `color-contrast` (4) |
| accesibilidad.html | **4** | `color-contrast` | `color-contrast` (4) |
| storyboard.html | **2** | `color-contrast` | `color-contrast` (22) |
| presentacion.html | 0 | — | `color-contrast` (4) |
| **TOTAL** | **8 nodos** | | **77 nodos** |

### Problemas concretos detectados

1. **Contraste insuficiente en `<code>`** (enlaces, accesibilidad, storyboard).
   Bootstrap aplica por defecto `code { color: #d63384 }` (rosa), que sobre los paneles oscuros del tema solo alcanza **3,58:1 – 4,05:1**, por debajo del mínimo AA de 4,5:1.

2. **Enlace en bloque de texto distinguible solo por color** (`facciones.html`): el enlace de transcripción del vídeo no tenía subrayado ni otra señal no cromática.

3. **`<audio>` sin pista de subtítulos/descripción** (`#musica-fondo`, en las 8 páginas): la regla `audio-caption` exige una pista de subtítulos asociada.

4. **Atributo ARIA no permitido** (`index.html`): `<div class="container-fluid" aria-label="...">` — un `div` sin rol no admite `aria-label` (`aria-prohibited-attr`).

5. **Contraste "incompleto"** (no es incumplimiento): axe no puede calcular el contraste del texto situado sobre el **degradado** de la cabecera ni sobre el texto de los **SVG** generados. Son elementos a **revisión manual**, no fallos confirmados.

---

## 3. Correcciones planificadas

| # | Corrección | Archivo(s) |
|---|---|---|
| F1 | Cabecera con fondo sólido (evaluable por las herramientas) + override de color de `code` a `--sw-blue` (7,17:1 / 6,34:1) + subrayado de enlaces en texto | `css/style.css` |
| F2 | Pista de subtítulos `<track kind="captions">` en el audio ambiental | las 8 páginas |
| F3 | Archivo WebVTT de descripción del audio | `audio/ambient.es.vtt` |
| F4 | `role="group"` en el `div` con `aria-label` | `index.html` |
| F5 | Insignia de certificación de accesibilidad en el pie | las 8 páginas |

> El informe **después** (`docs/informe-accesibilidad-despues.md`) recoge el resultado tras aplicar estas correcciones, con los mismos comandos y parámetros.
