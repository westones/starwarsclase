// ============================================================
// presentacion.js - Accessible 10-slide deck (only on Presentacion).
//
// Progressive enhancement: the HTML ships all slides visible so the
// content survives without JavaScript. On boot this module keeps a
// single slide visible and wires:
//   - #deck-prev / #deck-next buttons
//   - a keyboard handler (ArrowLeft, ArrowRight, Home, End)
//   - a slide counter (#deck-actual / #deck-total)
//   - a polite live region (#deck-anuncio) announcing the change
//
// Hidden slides carry the `hidden` attribute, so both the native
// read speaker (lector.js) and screen readers skip them.
// ============================================================

(function () {
  "use strict";

  // jQuery is loaded before this file; bail out safely if it is not.
  if (typeof window.jQuery === "undefined") return;

  var $ = window.jQuery;

  // Spanish UI strings (UI copy is Spanish; identifiers stay English).
  var TEXTO_DIAPOSITIVA = "Diapositiva ";

  $(function () {
    var $deck = $(".deck");
    if ($deck.length === 0) return; // only exists on Presentacion

    var $slides = $deck.find(".slide");
    var total = $slides.length;
    if (total === 0) return;

    var $prev = $("#deck-prev");
    var $next = $("#deck-next");
    var $actual = $("#deck-actual");
    var $total = $("#deck-total");
    var $anuncio = $("#deck-anuncio");

    var indice = 0;

    // Total is derived from the DOM so it never drifts from the markup.
    $total.text(total);

    // Title of a given slide, used in the live announcement.
    function tituloDe(posicion) {
      var $titulo = $slides.eq(posicion).find(".slide-title").first();
      return $titulo.length
        ? $.trim($titulo.text())
        : TEXTO_DIAPOSITIVA + (posicion + 1);
    }

    // Applies the state for the current index.
    function pintar(anunciarCambio) {
      $slides.each(function (i) {
        var activa = i === indice;
        if (activa) {
          $(this).removeAttr("hidden");
        } else {
          $(this).attr("hidden", "hidden");
        }
      });

      $actual.text(indice + 1);
      $prev.prop("disabled", indice === 0);
      $next.prop("disabled", indice === total - 1);

      if (anunciarCambio) {
        // Clear first so repeated equal messages are re-announced.
        $anuncio.text("");
        window.setTimeout(function () {
          $anuncio.text(
            TEXTO_DIAPOSITIVA + (indice + 1) + " de " + total + ": " + tituloDe(indice) + "."
          );
        }, 50);
      }
    }

    // Moves to a target index, clamped to the valid range.
    function ir(destino) {
      var nuevo = Math.max(0, Math.min(total - 1, destino));
      if (nuevo === indice) return;
      indice = nuevo;
      pintar(true);
    }

    $prev.on("click", function () {
      ir(indice - 1);
    });

    $next.on("click", function () {
      ir(indice + 1);
    });

    // Keyboard navigation. Ignored while typing in a form control and
    // when a modifier key is held, so it never hijacks browser shortcuts.
    $(document).on("keydown", function (evento) {
      var etiqueta = (evento.target && evento.target.tagName) || "";
      if (etiqueta === "INPUT" || etiqueta === "TEXTAREA" || etiqueta === "SELECT") return;
      if (evento.altKey || evento.ctrlKey || evento.metaKey) return;

      var tecla = evento.key;
      if (tecla === "ArrowLeft") {
        ir(indice - 1);
        evento.preventDefault();
      } else if (tecla === "ArrowRight") {
        ir(indice + 1);
        evento.preventDefault();
      } else if (tecla === "Home") {
        indice = 0;
        pintar(true);
        evento.preventDefault();
      } else if (tecla === "End") {
        indice = total - 1;
        pintar(true);
        evento.preventDefault();
      }
    });

    // Initial paint: no announcement on first load.
    pintar(false);
  });
})();
