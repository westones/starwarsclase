// ============================================================
// lector.js - Read speaker (Web Speech API / SpeechSynthesis).
//
// The shell ships two fixed buttons on every page:
//   #btn-leer            - read / pause / resume toggle
//   #btn-detener-lectura - stop and reset
//
// It reads ONLY the visible text of #contenido-principal, skips
// script/style/aria-hidden nodes, normalizes whitespace and splits
// the result into sentence-bounded chunks (~200 chars) so playback
// stays smooth and can be paused and resumed mid-page.
//
// Accessibility guarantees:
//   - The toggle exposes aria-pressed and a Spanish label per state.
//   - Start / pause / resume / stop are announced through an
//     aria-live="polite" region.
//   - When window.speechSynthesis is missing the buttons are
//     disabled and a visible + screen-reader note is shown.
//
// Documented fallback (NOT implemented on purpose, to avoid a
// network dependency): the Google Translate TTS endpoint could be
// used to synthesize audio server-side, but this module never makes
// a network call.
// ============================================================

(function () {
  "use strict";

  // Spanish UI strings (UI copy is Spanish; identifiers stay English).
  const ETIQUETA_INACTIVO = "Leer página";
  const ETIQUETA_LEYENDO = "Pausar lectura";
  const ETIQUETA_PAUSADO = "Reanudar lectura";
  const MAX_TROZO = 200; // target chunk length in characters
  const IDIOMA = "es-ES";
  const VELOCIDAD = 0.98;

  // Estados posibles del lector: "inactivo" | "leyendo" | "pausado".
  const estado = {
    modo: "inactivo",
    utterances: [],
    vozEspanola: null,
    soportado: typeof window.speechSynthesis !== "undefined" &&
      typeof window.SpeechSynthesisUtterance !== "undefined",
  };

  // DOM references, resolved on boot.
  let btnLeer = null;
  let btnDetener = null;
  let regionAnuncios = null;

  // ----------------------------------------------------------
  // Live region helpers
  // ----------------------------------------------------------

  // Ensures a visually-hidden polite live region exists and returns it.
  function asegurarRegionAnuncios() {
    let region = document.getElementById("lector-anuncios");
    if (!region) {
      region = document.createElement("p");
      region.id = "lector-anuncios";
      region.className = "visually-hidden";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    return region;
  }

  // Announces a short message to assistive technology.
  function anunciar(mensaje) {
    if (!regionAnuncios) return;
    // Clear first so repeated identical messages are re-announced.
    regionAnuncios.textContent = "";
    window.setTimeout(function () {
      regionAnuncios.textContent = mensaje;
    }, 50);
  }

  // ----------------------------------------------------------
  // Text collection
  // ----------------------------------------------------------

  // True when a text node belongs to visible, readable content.
  function nodoLegible(nodo) {
    const texto = nodo.nodeValue;
    if (!texto || !texto.trim()) return false;

    const el = nodo.parentElement;
    if (!el) return false;

    // Skip non-content and explicitly hidden subtrees.
    if (
      el.closest('script, style, noscript, template, [hidden], [aria-hidden="true"]')
    ) {
      return false;
    }

    // Skip CSS-hidden content (collapsed accordions, filtered cards...).
    const estilo = window.getComputedStyle(el);
    if (estilo.display === "none" || estilo.visibility === "hidden") {
      return false;
    }
    return true;
  }

  // Returns the normalized visible text of a root element.
  function extraerTexto(root) {
    if (!root) return "";

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (nodo) {
        return nodoLegible(nodo) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });

    const partes = [];
    let nodo = walker.nextNode();
    while (nodo) {
      partes.push(nodo.nodeValue.replace(/\s+/g, " ").trim());
      nodo = walker.nextNode();
    }

    return partes.join(" ").replace(/\s+/g, " ").trim();
  }

  // ----------------------------------------------------------
  // Segmentation
  // ----------------------------------------------------------

  // Splits a long sentence into <=MAX_TROZO pieces on clause boundaries,
  // then by hard slicing, so nothing is left unread.
  function trocearFraseLarga(frase) {
    const trozos = [];
    const partes = frase.split(/(?<=[,;:])\s+/);
    let buffer = "";

    partes.forEach(function (parte) {
      if ((buffer + " " + parte).trim().length > MAX_TROZO) {
        if (buffer) trozos.push(buffer.trim());
        let resto = parte;
        while (resto.length > MAX_TROZO) {
          trozos.push(resto.slice(0, MAX_TROZO).trim());
          resto = resto.slice(MAX_TROZO);
        }
        buffer = resto;
      } else {
        buffer = (buffer + " " + parte).trim();
      }
    });

    if (buffer) trozos.push(buffer.trim());
    return trozos;
  }

  // Splits text into sentence-bounded chunks of ~MAX_TROZO characters.
  function segmentarTexto(texto) {
    const limpio = String(texto || "").replace(/\s+/g, " ").trim();
    if (!limpio) return [];

    // Prefer Intl.Segmenter (accurate sentence boundaries), fall back to
    // a simple punctuation regex.
    let frases = [];
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      const segmentador = new Intl.Segmenter(IDIOMA, { granularity: "sentence" });
      frases = Array.from(segmentador.segment(limpio), function (s) {
        return s.segment.trim();
      }).filter(Boolean);
    } else {
      frases = (limpio.match(/[^.!?…]+[.!?…]*/g) || [limpio])
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
    }

    const trozos = [];
    let actual = "";

    frases.forEach(function (frase) {
      if (frase.length > MAX_TROZO) {
        if (actual) {
          trozos.push(actual.trim());
          actual = "";
        }
        trocearFraseLarga(frase).forEach(function (trozo) {
          trozos.push(trozo);
        });
        return;
      }

      if ((actual + " " + frase).trim().length > MAX_TROZO) {
        if (actual) trozos.push(actual.trim());
        actual = frase;
      } else {
        actual = (actual + " " + frase).trim();
      }
    });

    if (actual) trozos.push(actual.trim());
    return trozos;
  }

  // ----------------------------------------------------------
  // Voice selection
  // ----------------------------------------------------------

  // Picks the best Spanish voice available: es-ES first, then any "es".
  function elegirVoz() {
    if (!estado.soportado) return;
    const voces = window.speechSynthesis.getVoices() || [];
    if (voces.length === 0) return;

    estado.vozEspanola =
      voces.find(function (v) {
        return /^es[-_]ES/i.test(v.lang);
      }) ||
      voces.find(function (v) {
        return /^es/i.test(v.lang);
      }) ||
      null;
  }

  // ----------------------------------------------------------
  // UI state
  // ----------------------------------------------------------

  // Reflects the current mode on the toggle button and the live region.
  function actualizarInterfaz() {
    if (!btnLeer) return;

    const activo = estado.modo !== "inactivo";
    btnLeer.setAttribute("aria-pressed", activo ? "true" : "false");

    if (estado.modo === "leyendo") {
      btnLeer.textContent = ETIQUETA_LEYENDO;
    } else if (estado.modo === "pausado") {
      btnLeer.textContent = ETIQUETA_PAUSADO;
    } else {
      btnLeer.textContent = ETIQUETA_INACTIVO;
    }
  }

  // ----------------------------------------------------------
  // Playback
  // ----------------------------------------------------------

  // Stops the current queue and returns to the idle state.
  function detener(silencioso) {
    if (!estado.soportado) return;
    window.speechSynthesis.cancel();
    estado.utterances = [];
    estado.modo = "inactivo";
    actualizarInterfaz();
    if (!silencioso) anunciar("Lectura detenida.");
  }

  // Builds the utterance queue for an array of text chunks and speaks it.
  function hablarTrozos(trozos, mensajeInicio) {
    if (!estado.soportado || !trozos.length) return;

    // Cancel anything in flight; a fresh tick avoids a Chromium stall.
    window.speechSynthesis.cancel();

    estado.utterances = trozos.map(function (trozo, indice) {
      const utterance = new window.SpeechSynthesisUtterance(trozo);
      utterance.lang = IDIOMA;
      utterance.rate = VELOCIDAD;
      if (estado.vozEspanola) utterance.voice = estado.vozEspanola;

      // When the LAST chunk ends naturally, reset the UI.
      if (indice === trozos.length - 1) {
        utterance.onend = function () {
          estado.modo = "inactivo";
          estado.utterances = [];
          actualizarInterfaz();
          anunciar("Lectura finalizada.");
        };
      }

      // Ignore "interrupted"/"canceled" errors (they are expected on stop).
      utterance.onerror = function (evento) {
        const tipo = evento && evento.error;
        if (tipo === "interrupted" || tipo === "canceled") return;
        estado.modo = "inactivo";
        estado.utterances = [];
        actualizarInterfaz();
        anunciar("No se pudo reproducir la lectura.");
      };

      return utterance;
    });

    estado.modo = "leyendo";
    actualizarInterfaz();

    estado.utterances.forEach(function (utterance) {
      window.speechSynthesis.speak(utterance);
    });

    anunciar(mensajeInicio || "Lectura en voz alta iniciada.");
  }

  // Reads a specific string (used by the [data-leer] bonus targets).
  function leerTexto(texto, etiqueta) {
    const trozos = segmentarTexto(texto);
    if (!trozos.length) {
      anunciar("No hay contenido legible en este elemento.");
      return;
    }
    hablarTrozos(trozos, (etiqueta || "Lectura") + " en voz alta iniciada.");
  }

  // ----------------------------------------------------------
  // Toggle button behaviour
  // ----------------------------------------------------------

  function alPulsarLeer() {
    if (!estado.soportado) return;

    if (estado.modo === "inactivo") {
      const main = document.getElementById("contenido-principal");
      const trozos = segmentarTexto(extraerTexto(main));
      if (!trozos.length) {
        anunciar("No hay contenido para leer en esta página.");
        return;
      }
      hablarTrozos(trozos, "Lectura en voz alta iniciada.");
      return;
    }

    if (estado.modo === "leyendo") {
      window.speechSynthesis.pause();
      estado.modo = "pausado";
      actualizarInterfaz();
      anunciar("Lectura en pausa.");
      return;
    }

    if (estado.modo === "pausado") {
      window.speechSynthesis.resume();
      estado.modo = "leyendo";
      actualizarInterfaz();
      anunciar("Lectura reanudada.");
    }
  }

  // ----------------------------------------------------------
  // [data-leer] bonus: read a single element on demand
  // ----------------------------------------------------------

  function conectarObjetivosLectura() {
    const objetivos = document.querySelectorAll("[data-leer]");
    Array.prototype.forEach.call(objetivos, function (elemento) {
      // Make it reachable and operable by keyboard without breaking
      // elements that already declare their own semantics.
      if (!elemento.hasAttribute("tabindex")) elemento.setAttribute("tabindex", "0");
      if (!elemento.hasAttribute("role")) elemento.setAttribute("role", "button");

      function activar(evento) {
        if (evento.type === "keydown") {
          if (evento.key !== "Enter" && evento.key !== " ") return;
          evento.preventDefault();
        }
        leerTexto(elemento.textContent, "Elemento");
      }

      elemento.addEventListener("click", activar);
      elemento.addEventListener("keydown", activar);
    });
  }

  // ----------------------------------------------------------
  // Unsupported-browser fallback
  // ----------------------------------------------------------

  function mostrarNoSoportado() {
    if (btnLeer) {
      btnLeer.disabled = true;
      btnLeer.setAttribute("aria-pressed", "false");
      btnLeer.setAttribute("title", "Tu navegador no admite la lectura en voz alta.");
    }
    if (btnDetener) btnDetener.disabled = true;

    const barra = document.querySelector(".read-speaker-bar");
    if (barra && !document.getElementById("lector-nota")) {
      const nota = document.createElement("p");
      nota.id = "lector-nota";
      nota.className = "read-speaker-note";
      nota.setAttribute("role", "note");
      nota.textContent =
        "La lectura en voz alta no está disponible porque este navegador no " +
        "admite la Web Speech API. Como alternativa documentada podría usarse un " +
        "servicio de síntesis externo, como Google Translate TTS, aunque este sitio " +
        "no realiza llamadas de red.";
      barra.parentNode.insertBefore(nota, barra.nextSibling);
    }

    anunciar(
      "La lectura en voz alta no está disponible en este navegador. " +
        "Se documenta Google Translate TTS como alternativa, sin implementarla."
    );
  }

  // ----------------------------------------------------------
  // Boot
  // ----------------------------------------------------------
  function iniciar() {
    btnLeer = document.getElementById("btn-leer");
    btnDetener = document.getElementById("btn-detener-lectura");
    if (!btnLeer) return; // page without the shell controls

    regionAnuncios = asegurarRegionAnuncios();

    if (!estado.soportado) {
      mostrarNoSoportado();
      return;
    }

    // Voices may load asynchronously; refresh on the event too.
    elegirVoz();
    if (typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
      window.speechSynthesis.onvoiceschanged = elegirVoz;
    }
    window.speechSynthesis.addEventListener &&
      window.speechSynthesis.addEventListener("voiceschanged", elegirVoz);

    btnLeer.addEventListener("click", alPulsarLeer);

    if (btnDetener) {
      btnDetener.addEventListener("click", function () {
        detener(false);
      });
    }

    // Reset cleanly when the page is hidden or unloaded (avoids a
    // speech queue that keeps talking after navigation).
    window.addEventListener("pagehide", function () {
      detener(true);
    });

    conectarObjetivosLectura();
    actualizarInterfaz();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
