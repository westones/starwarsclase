// ============================================================
// navegacion.js - Global jQuery behaviours shared by every page.
//
// This is the site's main jQuery surface. It wires:
//   1) the music button  (#music-button  <-> #musica-fondo)
//   2) a "back to top" button injected with jQuery
//   3) the lightsaber accent picker  ([data-sable]) - Facciones
//   4) the "Personaje del día" sidebar widget  (#personaje-dia)
//   5) the mobile nav toggle  (.side-nav)
//   6) the alignment filter  ([data-alineacion]) - Facciones
//   7) the hyperspace button  (#btn-hiperespacio) - Facciones
//
// Every behaviour is guarded: all pages load this file, and none of
// the missing elements may throw. Elements that only exist on the
// Facciones page are guarded by a length check.
// ============================================================

(function () {
  "use strict";

  // jQuery is loaded before this file on every page; bail out safely
  // if it ever is not, so nothing throws.
  if (typeof window.jQuery === "undefined") return;

  var $ = window.jQuery;

  // ----------------------------------------------------------
  // Shared helpers
  // ----------------------------------------------------------

  // Ensures a visually-hidden polite live region exists.
  function regionAnuncios() {
    var $region = $("#navegacion-anuncios");
    if ($region.length === 0) {
      $region = $("<p></p>", {
        id: "navegacion-anuncios",
        "class": "visually-hidden",
        role: "status",
        "aria-live": "polite",
      }).appendTo("body");
    }
    return $region;
  }

  // Announces a short message to assistive technology.
  function anunciar($region, mensaje) {
    $region.text("");
    window.setTimeout(function () {
      $region.text(mensaje);
    }, 50);
  }

  // ----------------------------------------------------------
  // 1) Music button
  // ----------------------------------------------------------

  function iniciarMusica() {
    var $boton = $("#music-button");
    if ($boton.length === 0) return;

    var audio = document.getElementById("musica-fondo");

    function pintar(reproduciendo) {
      $boton.attr("aria-pressed", reproduciendo ? "true" : "false");
      $boton.text(reproduciendo ? "Apagar música" : "Encender música");
    }

    if (audio) {
      // Keep the button in sync with the real media state.
      $(audio)
        .on("play", function () {
          pintar(true);
        })
        .on("pause", function () {
          pintar(false);
        })
        .on("ended", function () {
          pintar(false);
        });
      pintar(!audio.paused);
    } else {
      pintar(false);
    }

    $boton.on("click", function () {
      if (!audio) return;
      if (audio.paused) {
        var promesa = audio.play();
        if (promesa && typeof promesa.catch === "function") {
          promesa.catch(function () {
            pintar(false);
          });
        }
      } else {
        audio.pause();
      }
    });
  }

  // ----------------------------------------------------------
  // 2) Back to top
  // ----------------------------------------------------------

  function iniciarVolverArriba() {
    var $arriba = $("<button></button>", {
      id: "volver-arriba",
      "class": "sw-btn ghost volver-arriba",
      type: "button",
      text: "Volver arriba",
      "aria-label": "Volver al principio de la página",
    }).appendTo("body");

    // Keyboard accessible because it is a real <button>.
    $arriba.on("click", function () {
      $("html, body").stop(true).animate({ scrollTop: 0 }, 500);
    });

    // Fade in/out based on scroll position.
    $(window).on("scroll", function () {
      if ($(this).scrollTop() > 400) {
        $arriba.fadeIn(200);
      } else {
        $arriba.fadeOut(200);
      }
    });
  }

  // ----------------------------------------------------------
  // 3) Lightsaber accent picker (Facciones)
  // ----------------------------------------------------------

  // Accent colour for each saber. Values are the exact rubric colours.
  var SABLES = {
    azul: "#5aa9e6",
    verde: "#43d17c",
    rojo: "#ff4d4d",
    morado: "#b085f5",
    dorado: "#ffe81f",
  };
  var SABLE_DEFECTO = "dorado";
  var CLAVE_ALMACEN = "sw-sable";

  // Audio element for the saber ignition sound, created lazily.
  var sableAudio = null;

  function reproducirSable() {
    try {
      if (!sableAudio) sableAudio = new Audio("audio/sable.mp3");
      sableAudio.currentTime = 0;
      var promesa = sableAudio.play();
      if (promesa && typeof promesa.catch === "function") {
        promesa.catch(function () {
          /* Autoplay blocked or file missing: stay silent. */
        });
      }
    } catch (error) {
      /* Never let a sound failure break the picker. */
    }
  }

  // Applies an accent, persists it and updates the button states.
  function aplicarSable(clave, $botones, $region, anunciarCambio) {
    var color = SABLES[clave] || SABLES[SABLE_DEFECTO];
    document.documentElement.style.setProperty("--sw-gold", color);

    $botones.attr("aria-pressed", function () {
      return this.getAttribute("data-sable") === clave ? "true" : "false";
    });

    try {
      window.localStorage.setItem(CLAVE_ALMACEN, clave);
    } catch (error) {
      /* Private mode: just skip persistence. */
    }

    if (anunciarCambio) {
      anunciar($region, "Sable " + clave + " seleccionado.");
    }
  }

  function iniciarSable($region) {
    var $botones = $("[data-sable]");
    if ($botones.length === 0) return; // only exists on Facciones

    // Restore the saved accent (falls back to the default).
    var guardado = null;
    try {
      guardado = window.localStorage.getItem(CLAVE_ALMACEN);
    } catch (error) {
      guardado = null;
    }
    aplicarSable(
      guardado && SABLES[guardado] ? guardado : SABLE_DEFECTO,
      $botones,
      $region,
      false
    );

    $botones.on("click", function () {
      var clave = this.getAttribute("data-sable");
      if (!SABLES[clave]) return;
      aplicarSable(clave, $botones, $region, true);
      reproducirSable();
    });
  }

  // ----------------------------------------------------------
  // 4) "Personaje del día"
  // ----------------------------------------------------------

  // Day-of-year index (1..366), used as a deterministic selector.
  function diaDelAnio(fecha) {
    var inicio = new Date(fecha.getFullYear(), 0, 0);
    return Math.floor((fecha - inicio) / 86400000);
  }

  // True while the widget still shows its server-rendered placeholder.
  function esPlaceholder($widget) {
    return (
      $widget.find(".img-placeholder").length > 0 ||
      /\u00bfQui\u00e9n ser\u00e1 hoy\?/.test($widget.text())
    );
  }

  function pintarPersonajeDia($widget, persona, id) {
    var nombre = persona && persona.name ? persona.name : "";
    if (!nombre) return;

    var escapar =
      typeof window.escaparHtml === "function"
        ? window.escaparHtml
        : function (texto) {
            return String(texto == null ? "" : texto);
          };

    var avatar =
      typeof window.avatarDe === "function" ? window.avatarDe(nombre, 120) : "";

    $widget.html(
      '<div class="personaje-dia-image personaje-dia-avatar">' +
        avatar +
        "</div>" +
        '<p class="personaje-dia-number">#' +
        escapar(id) +
        "</p>" +
        '<p class="personaje-dia-name">' +
        escapar(nombre) +
        "</p>" +
        '<p class="personaje-dia-link"><a href="personajes.html">Ver en Personajes</a></p>'
    );
  }

  function iniciarPersonajeDia() {
    var $widget = $("#personaje-dia");
    if ($widget.length === 0 || !esPlaceholder($widget)) return;
    if (typeof window.getPeople !== "function" || typeof window.getPerson !== "function") {
      return;
    }

    var indice = diaDelAnio(new Date());

    window
      .getPeople(1)
      .then(function (pagina) {
        var lista = (pagina && pagina.results) || [];
        if (lista.length === 0) return null;

        var base = lista[indice % lista.length];
        // Fetch the full record; fall back to the list entry on failure.
        return window
          .getPerson(base.url)
          .catch(function () {
            return base;
          })
          .then(function (completo) {
            var id =
              typeof window.extractId === "function"
                ? window.extractId((completo && completo.url) || base.url)
                : "";
            pintarPersonajeDia($widget, completo || base, id);
          });
      })
      .catch(function () {
        /* Offline or API error: keep the placeholder silently. */
      });
  }

  // ----------------------------------------------------------
  // 5) Mobile navigation toggle
  // ----------------------------------------------------------

  function iniciarMenuMovil() {
    var $nav = $(".side-nav");
    if ($nav.length === 0) return;

    var $panel = $nav.closest(".navigation-panel");
    var $titulo = $panel.find(".panel-title");
    if ($titulo.length === 0) return;

    if (!$nav.attr("id")) $nav.attr("id", "menu-principal");

    var $toggle = $("<button></button>", {
      id: "btn-menu",
      "class": "sw-btn ghost nav-toggle",
      type: "button",
      text: "Menú",
      "aria-controls": $nav.attr("id"),
    });
    $titulo.after($toggle);

    var media = window.matchMedia("(max-width: 820px)");

    function sincronizar() {
      if (media.matches) {
        $nav.addClass("nav-collapsed");
        $toggle.attr("aria-expanded", "false");
      } else {
        $nav.removeClass("nav-collapsed");
        $toggle.attr("aria-expanded", "true");
      }
    }

    $toggle.on("click", function () {
      var colapsado = $nav.toggleClass("nav-collapsed").hasClass("nav-collapsed");
      $(this).attr("aria-expanded", colapsado ? "false" : "true");
    });

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sincronizar);
    } else if (typeof media.addListener === "function") {
      media.addListener(sincronizar);
    }

    sincronizar();
  }

  // ----------------------------------------------------------
  // 6) Alignment filter (Facciones)
  // ----------------------------------------------------------

  function iniciarFiltroAlineacion($region) {
    var $filtros = $("[data-alineacion]");
    var $cartas = $(".faccion-card");
    if ($filtros.length === 0 || $cartas.length === 0) return;

    $filtros.on("click", function () {
      var valor = this.getAttribute("data-alineacion");

      $filtros.attr("aria-pressed", function () {
        return this.getAttribute("data-alineacion") === valor ? "true" : "false";
      });

      var visibles = 0;
      $cartas.each(function () {
        var alineacion = this.getAttribute("data-alineacion");
        var mostrar = valor === "todo" || alineacion === valor;
        $(this).stop(true, true).toggle(mostrar);
        if (mostrar) visibles += 1;
      });

      anunciar(
        $region,
        visibles === 1
          ? "1 facción mostrada."
          : visibles + " facciones mostradas."
      );
    });
  }

  // ----------------------------------------------------------
  // 7) Hyperspace toggle (Facciones canvas)
  // ----------------------------------------------------------

  function iniciarHiperespacio($region) {
    var $boton = $("#btn-hiperespacio");
    if ($boton.length === 0) return;

    $boton.on("click", function () {
      var activo = $(this).attr("aria-pressed") !== "true";
      $(this).attr("aria-pressed", activo ? "true" : "false");
      $(this).text(activo ? "Desactivar hiperespacio" : "Activar hiperespacio");

      if (typeof window.fijarHiperespacio === "function") {
        window.fijarHiperespacio(activo);
      }
      anunciar(
        $region,
        activo ? "Hiperespacio activado." : "Hiperespacio desactivado."
      );
    });
  }

  // ----------------------------------------------------------
  // Boot
  // ----------------------------------------------------------
  $(function () {
    var $region = regionAnuncios();

    iniciarMusica();
    iniciarVolverArriba();
    iniciarSable($region);
    iniciarPersonajeDia();
    iniciarMenuMovil();
    iniciarFiltroAlineacion($region);
    iniciarHiperespacio($region);
  });
})();
