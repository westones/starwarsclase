// ============================================================
// lector.js - Read speaker (Web Speech API + network fallback).
//
// The shell ships two fixed buttons on every page:
//   #btn-leer            - read / pause / resume toggle
//   #btn-detener-lectura - stop and reset
//
// It reads ONLY the visible text of #contenido-principal, skips
// script/style/aria-hidden nodes, normalizes whitespace and splits
// the result into sentence-bounded chunks so playback stays smooth
// and can be paused and resumed mid-page.
//
// TWO ENGINES (motor):
//   1. "local"  - window.speechSynthesis (Web Speech API). Preferred,
//                 works offline, requires an installed system voice.
//   2. "red"    - Google Translate TTS, played through an <audio>
//                 element. Used when the browser exposes NO local
//                 voices (common on Linux without speech-dispatcher),
//                 so the read-speaker still works. Requires internet.
//
// The engine is chosen at click time (not at boot) because voices can
// load asynchronously via the "voiceschanged" event.
//
// Accessibility guarantees:
//   - The toggle exposes aria-pressed and a Spanish label per state.
//   - Start / pause / resume / stop / failure are announced through an
//     aria-live="polite" region.
//   - A visible note explains when the network engine is in use.
// ============================================================

(function () {
  "use strict";

  // Spanish UI strings (UI copy is Spanish; identifiers stay English).
  const ETIQUETA_INACTIVO = "Leer página";
  const ETIQUETA_LEYENDO = "Pausar lectura";
  const ETIQUETA_PAUSADO = "Reanudar lectura";
  const MAX_TROZO_LOCAL = 200; // local engine chunk length (characters)
  const MAX_TROZO_RED = 180; // network engine chunk (Google caps ~200)
  const IDIOMA = "es-ES";
  const VELOCIDAD = 0.98;

  // Google Translate TTS endpoint (unofficial, used as a documented
  // fallback only). Playback happens through <audio src>, so no CORS
  // request is made for the audio body.
  const URL_TTS_RED =
    "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=es&q=";

  // Estados posibles: "inactivo" | "leyendo" | "pausado".
  const estado = {
    modo: "inactivo",
    motor: null, // "local" | "red"
    utterances: [],
    audio: null, // <audio> used by the network engine
    trozos: [],
    indice: 0,
    vozEspanola: null,
    soportado:
      typeof window.speechSynthesis !== "undefined" &&
      typeof window.SpeechSynthesisUtterance !== "undefined",
  };

  // DOM references, resolved on boot.
  let btnLeer = null;
  let btnDetener = null;
  let regionAnuncios = null;
  let notaRed = null;

  // ----------------------------------------------------------
  // Live region helpers
  // ----------------------------------------------------------

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

  function anunciar(mensaje) {
    if (!regionAnuncios) return;
    // Clear first so repeated identical messages are re-announced.
    regionAnuncios.textContent = "";
    window.setTimeout(function () {
      regionAnuncios.textContent = mensaje;
    }, 50);
  }

  // Small visible note shown once, the first time the network engine runs.
  function mostrarNotaRed() {
    if (notaRed) return;
    const barra = document.querySelector(".read-speaker-bar");
    if (!barra) return;
    notaRed = document.createElement("p");
    notaRed.id = "lector-nota-red";
    notaRed.className = "read-speaker-note";
    notaRed.setAttribute("role", "note");
    notaRed.textContent =
      "Tu sistema no tiene voces instaladas. La lectura intenta usar un servicio " +
      "de voz por internet, pero los navegadores modernos suelen bloquearlo. " +
      "Para activar la lectura en voz alta, instala un motor de voz del sistema " +
      "(por ejemplo, speech-dispatcher y espeak-ng).";
    barra.parentNode.insertBefore(notaRed, barra.nextSibling);
  }

  // ----------------------------------------------------------
  // Text collection
  // ----------------------------------------------------------

  function nodoLegible(nodo) {
    const texto = nodo.nodeValue;
    if (!texto || !texto.trim()) return false;

    const el = nodo.parentElement;
    if (!el) return false;

    if (
      el.closest(
        'script, style, noscript, template, [hidden], [aria-hidden="true"]'
      )
    ) {
      return false;
    }

    const estilo = window.getComputedStyle(el);
    if (estilo.display === "none" || estilo.visibility === "hidden") {
      return false;
    }
    return true;
  }

  function extraerTexto(root) {
    if (!root) return "";

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (nodo) {
        return nodoLegible(nodo)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
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

  function trocearFraseLarga(frase, maxTrozo) {
    const trozos = [];
    const partes = frase.split(/(?<=[,;:])\s+/);
    let buffer = "";

    partes.forEach(function (parte) {
      if ((buffer + " " + parte).trim().length > maxTrozo) {
        if (buffer) trozos.push(buffer.trim());
        let resto = parte;
        while (resto.length > maxTrozo) {
          trozos.push(resto.slice(0, maxTrozo).trim());
          resto = resto.slice(maxTrozo);
        }
        buffer = resto;
      } else {
        buffer = (buffer + " " + parte).trim();
      }
    });

    if (buffer) trozos.push(buffer.trim());
    return trozos;
  }

  // Splits text into sentence-bounded chunks of ~maxTrozo characters.
  function segmentarTexto(texto, maxTrozo) {
    const limite = maxTrozo || MAX_TROZO_LOCAL;
    const limpio = String(texto || "").replace(/\s+/g, " ").trim();
    if (!limpio) return [];

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
      if (frase.length > limite) {
        if (actual) {
          trozos.push(actual.trim());
          actual = "";
        }
        trocearFraseLarga(frase, limite).forEach(function (trozo) {
          trozos.push(trozo);
        });
        return;
      }

      if ((actual + " " + frase).trim().length > limite) {
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
  // Engine selection + voice selection
  // ----------------------------------------------------------

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
      voces[0];
  }

  // Local voices available right now (Chrome/Chromium require libspeechd
  // on Linux; without it getVoices() is empty).
  function hayVocesLocales() {
    if (!estado.soportado) return false;
    const voces = window.speechSynthesis.getVoices() || [];
    return voces.length > 0;
  }

  // Chooses the engine for THIS utterance. Local wins if available.
  function elegirMotor() {
    return hayVocesLocales() ? "local" : "red";
  }

  // ----------------------------------------------------------
  // UI state
  // ----------------------------------------------------------

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

  // Resets internal playback state (does not touch the live region).
  function reiniciarEstado() {
    estado.utterances = [];
    estado.trozos = [];
    estado.indice = 0;
    estado.audio = null;
    estado.motor = null;
    estado.modo = "inactivo";
    actualizarInterfaz();
  }

  // ----------------------------------------------------------
  // Network engine (Google Translate TTS via <audio>)
  // ----------------------------------------------------------

  function reproducirTrozoRed() {
    if (!estado.audio) return;

    if (estado.indice >= estado.trozos.length) {
      reiniciarEstado();
      anunciar("Lectura finalizada.");
      return;
    }

    const trozo = estado.trozos[estado.indice];
    estado.audio.src = URL_TTS_RED + encodeURIComponent(trozo);
    const promesa = estado.audio.play();
    if (promesa && typeof promesa.catch === "function") {
      promesa.catch(function () {
        // Autoplay blocked or network failure.
        reiniciarEstado();
        anunciar("No se pudo reproducir la lectura por internet.");
      });
    }
  }

  function hablarConRed(trozos, mensajeInicio) {
    if (!trozos.length) return;

    // Fresh audio element per playback so events never leak between runs.
    const audio = new Audio();
    audio.preload = "auto";
    estado.audio = audio;
    estado.trozos = trozos;
    estado.indice = 0;

    audio.addEventListener("ended", function () {
      estado.indice += 1;
      reproducirTrozoRed();
    });

    audio.addEventListener("error", function () {
      reiniciarEstado();
      anunciar(
        "La lectura por internet no está disponible: el navegador bloquea el " +
          "servicio de voz externo. Instala un motor de voz del sistema."
      );
    });

    estado.motor = "red";
    estado.modo = "leyendo";
    mostrarNotaRed();
    actualizarInterfaz();
    anunciar(mensajeInicio || "Lectura en voz alta iniciada.");
    reproducirTrozoRed();
  }

  // ----------------------------------------------------------
  // Local engine (Web Speech API)
  // ----------------------------------------------------------

  function hablarConLocal(trozos, mensajeInicio) {
    if (!estado.soportado || !trozos.length) return;

    // Cancel anything in flight; a fresh tick avoids a Chromium stall.
    window.speechSynthesis.cancel();

    estado.utterances = trozos.map(function (trozo, indice) {
      const utterance = new window.SpeechSynthesisUtterance(trozo);
      utterance.lang = IDIOMA;
      utterance.rate = VELOCIDAD;
      if (estado.vozEspanola) utterance.voice = estado.vozEspanola;

      if (indice === trozos.length - 1) {
        utterance.onend = function () {
          reiniciarEstado();
          anunciar("Lectura finalizada.");
        };
      }

      utterance.onerror = function (evento) {
        const tipo = evento && evento.error;
        if (tipo === "interrupted" || tipo === "canceled") return;
        // Local engine failed mid-way (e.g. the voice disappeared):
        // fall back to the network engine so the user still hears it.
        const restantes = trozos.slice(indice);
        if (restantes.length) {
          hablarConRed(restantes, "Lectura en voz alta iniciada.");
        } else {
          reiniciarEstado();
          anunciar("No se pudo reproducir la lectura.");
        }
      };

      return utterance;
    });

    estado.motor = "local";
    estado.modo = "leyendo";
    actualizarInterfaz();

    estado.utterances.forEach(function (utterance) {
      window.speechSynthesis.speak(utterance);
    });

    anunciar(mensajeInicio || "Lectura en voz alta iniciada.");
  }

  // Dispatches to the chosen engine.
  function hablarTrozos(trozos, mensajeInicio) {
    if (!trozos.length) return;
    if (elegirMotor() === "local") {
      hablarConLocal(trozos, mensajeInicio);
    } else {
      hablarConRed(trozos, mensajeInicio);
    }
  }

  function leerTexto(texto, etiqueta) {
    const motor = elegirMotor();
    const max = motor === "red" ? MAX_TROZO_RED : MAX_TROZO_LOCAL;
    const trozos = segmentarTexto(texto, max);
    if (!trozos.length) {
      anunciar("No hay contenido legible en este elemento.");
      return;
    }
    hablarTrozos(trozos, (etiqueta || "Lectura") + " en voz alta iniciada.");
  }

  // ----------------------------------------------------------
  // Stop / toggle
  // ----------------------------------------------------------

  function detener(silencioso) {
    if (estado.soportado && estado.motor === "local") {
      window.speechSynthesis.cancel();
    }
    if (estado.audio) {
      try {
        estado.audio.pause();
        estado.audio.removeAttribute("src");
      } catch (e) {
        /* ignore */
      }
    }
    reiniciarEstado();
    if (!silencioso) anunciar("Lectura detenida.");
  }

  function alPulsarLeer() {
    if (estado.modo === "inactivo") {
      const main = document.getElementById("contenido-principal");
      const motor = elegirMotor();
      const max = motor === "red" ? MAX_TROZO_RED : MAX_TROZO_LOCAL;
      const trozos = segmentarTexto(extraerTexto(main), max);
      if (!trozos.length) {
        anunciar("No hay contenido para leer en esta página.");
        return;
      }
      hablarTrozos(trozos, "Lectura en voz alta iniciada.");
      return;
    }

    if (estado.modo === "leyendo") {
      if (estado.motor === "local") {
        window.speechSynthesis.pause();
      } else if (estado.audio) {
        estado.audio.pause();
      }
      estado.modo = "pausado";
      actualizarInterfaz();
      anunciar("Lectura en pausa.");
      return;
    }

    if (estado.modo === "pausado") {
      if (estado.motor === "local") {
        window.speechSynthesis.resume();
      } else if (estado.audio) {
        const promesa = estado.audio.play();
        if (promesa && typeof promesa.catch === "function") {
          promesa.catch(function () {
            /* ignore: the error handler resets the state */
          });
        }
      }
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
  // Boot
  // ----------------------------------------------------------

  function iniciar() {
    btnLeer = document.getElementById("btn-leer");
    btnDetener = document.getElementById("btn-detener-lectura");
    if (!btnLeer) return; // page without the shell controls

    regionAnuncios = asegurarRegionAnuncios();

    // Voices may load asynchronously; refresh on the event too.
    elegirVoz();
    if (estado.soportado) {
      if (typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
        window.speechSynthesis.onvoiceschanged = elegirVoz;
      }
      if (window.speechSynthesis.addEventListener) {
        window.speechSynthesis.addEventListener("voiceschanged", elegirVoz);
      }
    }

    btnLeer.addEventListener("click", alPulsarLeer);

    if (btnDetener) {
      btnDetener.addEventListener("click", function () {
        detener(false);
      });
    }

    // Reset cleanly when the page is hidden or unloaded.
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
