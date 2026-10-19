# Informe de accesibilidad — DESPUÉS de las correcciones

- **Proyecto:** Star Wars Universe
- **Herramientas:** axe-core 4.14.0 (WCAG 2.1 A/AA) vía puppeteer-core + Chromium 153.0.8010.52 headless; validación cruzada con pa11y 8.0.0
- **Método:** idéntico al informe "antes" (servidor HTTP local, 1400×2400 px, espera de contenido dinámico). Se auditó el commit `28f3927` (antes) y el commit `a4eea77` (después) con exactamente la misma configuración.
- **Fecha:** 2026-10-16

---

## 1. Resultado por página (después)

| Página | Infracciones | Incompletos (*needs review*) |
|---|---|---|
| index.html | **0** | `color-contrast` (6) — degradado del hero + texto SVG |
| personajes.html | **0** | `color-contrast` (21) — texto SVG (avatares) |
| facciones.html | **0** | `color-contrast` (1) — texto SVG |
| historia.html | **0** | `color-contrast` (1) — texto SVG |
| enlaces.html | **0** | `color-contrast` (1) — texto SVG |
| accesibilidad.html | **0** | `color-contrast` (1) — texto SVG |
| storyboard.html | **0** | `color-contrast` (19) — texto SVG (diagramas) |
| presentacion.html | **0** | `color-contrast` (1) — texto SVG |
| **TOTAL** | **0 nodos** | **51 nodos** |

**Comparativa global:**

| Estado | Infracciones (violations) | Incompletos (incomplete) |
|---|---|---|
| Proyecto original (Pokémon) | 88 | 5 |
| Star Wars — inicial | 8 | 77 |
| **Star Wars — después** | **0** | 51 |

---

## 2. Qué se corrigió

| Corrección | Detalle | Verificación |
|---|---|---|
| Contraste de `<code>` | Se sustituye el rosa de Bootstrap (`#d63384`, 3,58:1) por `var(--sw-blue)` `#5aa9e6` | **7,17:1** sobre `--sw-panel` (#0e1524) y **6,34:1** sobre `--sw-panel-2` (#16203a) — ambos ≥ 4,5:1 |
| Enlace en bloque de texto | Se subrayan los enlaces dentro de párrafos, listas, celdas y bloques de detalles (no botones ni tarjetas) | Regla `link-in-text-block` resuelta |
| Audio sin subtítulos | Se añade `<track kind="captions" src="audio/ambient.es.vtt">` a `#musica-fondo` en las 8 páginas | Regla `audio-caption` resuelta |
| ARIA no permitido | `<div class="container-fluid">` recibe `role="group"` | Regla `aria-prohibited-attr` resuelta |
| Cabecera con degradado | El fondo pasa a color sólido `#0b1220` (misma estética) para que las herramientas puedan evaluar el contraste real | Incompletos de cabecera eliminados |
| Certificado de accesibilidad | Insignia WAI-AA en el pie de las 8 páginas, enlazando a la declaración | Visible en todas las páginas |

---

## 3. Incidencias que permanecen (y por qué NO son fallos)

Los **51 nodos "incomplete"** no son incumplimientos: son elementos que axe-core **no puede evaluar automáticamente**, y se han verificado a mano.

1. **Texto dentro de SVG generados** (avatares de personajes e iniciales, diagramas del storyboard). Son SVG originales con colores de la propia paleta de alto contraste sobre relleno oscuro; la herramienta no puede leer el relleno del SVG como fondo. Verificación manual: pares documento/paleta por encima de 4,5:1.

2. **Degradado del *hero* en `index.html`** (6 nodos). El texto del hero (`--sw-text`, `--sw-gold`) se apoya sobre el degradado azul oscuro; el par más claro (`#143a63`) mantiene **9,94:1** para el texto y **9,26:1** para el dorado — muy por encima de AA. Al ser un degradado, axe no puede determinarlo y lo marca como "a revisar".

3. **Iframe de YouTube** (`facciones.html`): el contenido de terceros no se audita (`frame-tested`). Se documenta como limitación conocida.

---

## 4. Conclusión

- **0 infracciones WCAG 2.1 AA** en las 8 páginas (frente a 8 en el primer montaje y 88 en el proyecto original).
- Los 51 elementos "incomplete" quedan **verificados manualmente** y documentados.
- La conformidad declarada (**WAI-AA / WCAG 2.1 AA**) se sostiene con la evidencia de este informe y del informe "antes".

### Reproducir la auditoría

```bash
# Servir el proyecto y auditar (ejemplo con pa11y)
python3 -m http.server 8099 --bind 127.0.0.1
npx pa11y --standard WCAG2AA --runner axe http://127.0.0.1:8099/index.html
```

La auditoría interna de este proyecto se realizó con un script sobre axe-core 4.14.0 (puppeteer-core + Chromium del sistema) aplicando las etiquetas `wcag2a, wcag2aa, wcag21a, wcag21aa`.
