// ============================================================
// canvas.js - Starfield animation on <canvas id="fondo-estrellas">.
// Vanilla ES2017. No jQuery here.
//
// The warp field: ~200 stars travel outward from the centre. Each
// star stores a normalized direction (x, y) plus a depth z in (0, 1].
// Projecting through z gives free parallax: stars with a smaller z
// (closer to the viewer) move faster and grow, exactly like a real
// starfield. A sine wave per star adds an occasional twinkle.
//
// Public API (safe to call from any page):
//   window.iniciarEstrellas()        - (re)start / repaint the field
//   window.fijarHiperespacio(bool)   - x8 speed + longer trails
//
// Every page loads this file, so it MUST do nothing (and throw
// nothing) when there is no canvas in the document.
// ============================================================

(function () {
  "use strict";

  // ----------------------------------------------------------
  // Tunables
  // ----------------------------------------------------------
  const NUM_ESTRELLAS = 200; // star count
  const DPR_MAX = 2; // cap devicePixelRatio to keep the fill cheap
  const VELOCIDAD_BASE = 0.0016; // depth units per millisecond
  const FACTOR_HIPERESPACIO = 8; // speed multiplier in hyperspace
  const RADIO_RECICLAJE = 0.9; // star reaches the edge -> respawn
  const LONGITUD_ESTELA = 0.045; // trail length factor (base)
  const LONGITUD_ESTELA_HIPER = 0.16; // trail length factor (hyperspace)
  const RESIZE_DEBOUNCE_MS = 150;

  // State. null while no canvas / no animation is running.
  const estado = {
    canvas: null,
    ctx: null,
    estrellas: [],
    ancho: 0,
    alto: 0,
    dpr: 1,
    raf: 0,
    ultimoFrame: 0,
    hiperespacio: false,
    reducirMovimiento: false,
    mediaReducida: null,
    temporizadorResize: 0,
    activo: false,
  };

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  // Deterministic-ish random helpers (Math.random is fine for visuals).
  function aleatorio(min, max) {
    return min + Math.random() * (max - min);
  }

  // Builds one star with a fresh direction and a random depth.
  function nuevaEstrella(profundidadInicial) {
    return {
      x: aleatorio(-1, 1), // horizontal direction
      y: aleatorio(-1, 1), // vertical direction
      z: typeof profundidadInicial === "number" ? profundidadInicial : aleatorio(0.15, 1),
      brillo: aleatorio(0.6, 1), // base alpha
      parpadeo: aleatorio(0, Math.PI * 2), // twinkle phase
      velocidadParpadeo: aleatorio(0.0015, 0.004),
      color: Math.random() < 0.18 ? "255,232,31" : "233,238,247", // gold accents
    };
  }

  // Fills the star array (fresh field).
  function crearEstrellas() {
    const estrellas = [];
    for (let i = 0; i < NUM_ESTRELLAS; i++) {
      estrellas.push(nuevaEstrella());
    }
    return estrellas;
  }

  // Projects a star into screen coordinates.
  // Returns { x, y, escala } where escala grows as the star approaches.
  function proyectar(estrella) {
    const z = Math.max(estrella.z, 0.0001);
    const escala = 1 / z;
    return {
      x: estado.ancho / 2 + estrella.x * escala * (estado.ancho / 2),
      y: estado.alto / 2 + estrella.y * escala * (estado.alto / 2),
      escala: escala,
    };
  }

  // ----------------------------------------------------------
  // Sizing
  // ----------------------------------------------------------

  // Matches the canvas backing store to its CSS box times DPR (capped).
  // Returns true when the logical size actually changed.
  function ajustarTamano() {
    if (!estado.canvas) return false;

    const rect = estado.canvas.getBoundingClientRect();
    const anchoCss = Math.max(1, Math.round(rect.width || estado.canvas.width || 1000));
    const altoCss = Math.max(
      1,
      Math.round(rect.height || estado.canvas.height || 420)
    );

    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);

    const cambio = anchoCss !== estado.ancho || altoCss !== estado.alto || dpr !== estado.dpr;

    estado.ancho = anchoCss;
    estado.alto = altoCss;
    estado.dpr = dpr;

    estado.canvas.width = Math.round(anchoCss * dpr);
    estado.canvas.height = Math.round(altoCss * dpr);

    // Draw in CSS pixels; the transform maps them onto the scaled buffer.
    estado.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return cambio;
  }

  // ----------------------------------------------------------
  // Drawing
  // ----------------------------------------------------------

  // Draws the static field (used under prefers-reduced-motion).
  function dibujarEstatico() {
    const ctx = estado.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, estado.ancho, estado.alto);

    for (let i = 0; i < estado.estrellas.length; i++) {
      const punto = proyectar(estado.estrellas[i]);
      if (
        punto.x < -20 ||
        punto.x > estado.ancho + 20 ||
        punto.y < -20 ||
        punto.y > estado.alto + 20
      ) {
        continue;
      }
      const radio = Math.max(0.4, Math.min(2.6, estado.estrellas[i].brillo * punto.escala * 0.6));
      ctx.beginPath();
      ctx.arc(punto.x, punto.y, radio, 0, Math.PI * 2);
      ctx.fillStyle =
        "rgba(" + estado.estrellas[i].color + "," + estado.estrellas[i].brillo.toFixed(2) + ")";
      ctx.fill();
    }
  }

  // Advances and paints one animation frame.
  function dibujarFrame(ahora) {
    const ctx = estado.ctx;
    if (!ctx) return;

    const delta = estado.ultimoFrame
      ? Math.min(ahora - estado.ultimoFrame, 48) // clamp tab-switch spikes
      : 16;
    estado.ultimoFrame = ahora;

    const velocidad =
      VELOCIDAD_BASE * (estado.hiperespacio ? FACTOR_HIPERESPACIO : 1);
    const factorEstela = estado.hiperespacio
      ? LONGITUD_ESTELA_HIPER
      : LONGITUD_ESTELA;

    // Fade the previous frame instead of a hard clear: this is what
    // turns the moving dots into glowing trails.
    ctx.fillStyle = estado.hiperespacio
      ? "rgba(5, 7, 13, 0.28)"
      : "rgba(5, 7, 13, 0.45)";
    ctx.fillRect(0, 0, estado.ancho, estado.alto);

    for (let i = 0; i < estado.estrellas.length; i++) {
      const estrella = estado.estrellas[i];

      // Save the previous projection to draw the trail segment.
      const anterior = proyectar(estrella);

      // Move the star closer to the viewer.
      estrella.z -= velocidad * delta;

      // Recycle once it passes the viewer or leaves the viewport.
      if (estrella.z <= 0.02) {
        estado.estrellas[i] = nuevaEstrella(1);
        continue;
      }

      const punto = proyectar(estrella);

      // Twinkle: subtle alpha oscillation.
      estrella.parpadeo += estrella.velocidadParpadeo * delta;
      const parpadeo = 0.75 + 0.25 * Math.sin(estrella.parpadeo);
      const alpha = Math.max(0.15, Math.min(1, estrella.brillo * parpadeo));

      // Trail: a line from the previous point to the current one.
      const dx = punto.x - anterior.x;
      const dy = punto.y - anterior.y;
      const longitud = Math.sqrt(dx * dx + dy * dy);
      const estela =
        punto.escala * factorEstela * (estado.hiperespacio ? 1 : 1);

      if (longitud > 0.3 && estela > 0.5) {
        ctx.beginPath();
        ctx.moveTo(anterior.x, anterior.y);
        ctx.lineTo(punto.x, punto.y);
        ctx.strokeStyle = "rgba(" + estrella.color + "," + (alpha * 0.8).toFixed(2) + ")";
        ctx.lineWidth = Math.max(0.5, Math.min(2.2, estela * 0.35));
        ctx.stroke();
      }

      // Star head.
      const radio = Math.max(0.4, Math.min(2.8, estrella.brillo * punto.escala * 0.55));
      ctx.beginPath();
      ctx.arc(punto.x, punto.y, radio, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + estrella.color + "," + alpha.toFixed(2) + ")";
      ctx.fill();
    }

    estado.raf = window.requestAnimationFrame(dibujarFrame);
  }

  // ----------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------

  // Cancels a running frame loop (idempotent).
  function detenerBucle() {
    if (estado.raf) {
      window.cancelAnimationFrame(estado.raf);
      estado.raf = 0;
    }
  }

  // Starts the animation loop when motion is allowed.
  function iniciarBucle() {
    detenerBucle();
    if (estado.reducirMovimiento) {
      dibujarEstatico();
      return;
    }
    estado.ultimoFrame = 0;
    estado.raf = window.requestAnimationFrame(dibujarFrame);
  }

  // Public: (re)start / repaint the starfield. No-op without a canvas.
  function iniciarEstrellas() {
    if (!estado.canvas) return;
    ajustarTamano();
    if (estado.estrellas.length === 0) {
      estado.estrellas = crearEstrellas();
    }
    iniciarBucle();
  }

  // Public: enable/disable hyperspace (x8 speed, longer trails).
  function fijarHiperespacio(activo) {
    estado.hiperespacio = Boolean(activo);
    // Repaint immediately so reduced-motion users still see a change.
    if (estado.reducirMovimiento && estado.canvas) {
      estado.estrellas = crearEstrellas();
      dibujarEstatico();
    }
  }

  // Debounced resize handler: re-fit the buffer without thrashing.
  function alRedimensionar() {
    if (!estado.canvas) return;
    if (estado.temporizadorResize) {
      window.clearTimeout(estado.temporizadorResize);
    }
    estado.temporizadorResize = window.setTimeout(function () {
      const cambio = ajustarTamano();
      if (cambio && estado.reducirMovimiento) {
        dibujarEstatico();
      }
    }, RESIZE_DEBOUNCE_MS);
  }

  // Reacts to the prefers-reduced-motion media query changing at runtime.
  function alCambiarMovimiento(evento) {
    estado.reducirMovimiento = evento.matches;
    if (!estado.canvas) return;
    iniciarBucle();
  }

  // ----------------------------------------------------------
  // Boot
  // ----------------------------------------------------------
  function iniciar() {
    const canvas = document.getElementById("fondo-estrellas");
    if (!canvas || !canvas.getContext) return; // no canvas on this page

    estado.canvas = canvas;
    estado.ctx = canvas.getContext("2d");

    // Honour the user's motion preference from the start.
    if (window.matchMedia) {
      estado.mediaReducida = window.matchMedia("(prefers-reduced-motion: reduce)");
      estado.reducirMovimiento = estado.mediaReducida.matches;

      if (typeof estado.mediaReducida.addEventListener === "function") {
        estado.mediaReducida.addEventListener("change", alCambiarMovimiento);
      } else if (typeof estado.mediaReducida.addListener === "function") {
        // Older Safari.
        estado.mediaReducida.addListener(alCambiarMovimiento);
      }
    }

    estado.estrellas = crearEstrellas();
    ajustarTamano();
    iniciarBucle();

    window.addEventListener("resize", alRedimensionar, { passive: true });
    estado.activo = true;
  }

  // Always expose the public API, even when no canvas exists, so callers
  // in other modules never need to guard against undefined functions.
  window.iniciarEstrellas = iniciarEstrellas;
  window.fijarHiperespacio = fijarHiperespacio;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
