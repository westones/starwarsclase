// ============================================================
// dom.js - Presentation layer for the character explorer.
// Receives data and paints it. Fetching lives in api.js.
// Vanilla helpers (jQuery is only used by script.js for events).
// Every helper guards for absent DOM nodes: all pages load all
// scripts, so nothing here may throw on a page without the grid.
// ============================================================

// Spanish display names for the most common SWAPI species.
// Unknown names fall back to the original English label.
const ESPECIES_ES = {
  Human: "Humano",
  Droid: "Droide",
  Wookiee: "Wookiee",
  Rodian: "Rodiano",
  Hutt: "Hutt",
  Ewok: "Ewok",
  Gungan: "Gungan",
  "Twi'lek": "Twi'lek",
  Zabrak: "Zabrak",
  Yoda: "Yoda",
  Toydarian: "Toydariano",
  Neimodian: "Neimodiano",
  Kaminoan: "Kaminoano",
  Cerean: "Cereano",
  Ithorian: "Ithoriano",
  Nautolan: "Nautolano",
  Chagrian: "Chagriano",
  Mirialan: "Mirialano",
  Sullustan: "Sullustano",
  Geonosian: "Geonosiano",
  Tholothian: "Tholothiano",
  Iktotchi: "Iktotchi",
  Quermian: "Quermiano",
  Kaleesh: "Kaleesh",
  Togruta: "Togruta",
  Besalisk: "Besalisk",
  Skakoan: "Skakoano",
  "Pau'an": "Pau'an",
  Xexto: "Xexto",
  Toong: "Toong",
  Aleena: "Aleena",
};

// Colours used by the generated initials avatar. They map to theme tokens.
const PALETA_AVATAR = [
  "var(--sw-blue)",
  "var(--sw-green)",
  "var(--sw-purple)",
  "var(--sw-orange)",
  "var(--sw-red)",
];

// Per-character cache of resolved extras (homeworld, species, films).
// Keyed by character name. Avoids refetching when re-rendering on filter.
const cacheExtras = new Map();

// Cached species catalogue for the filter select.
let cacheEspecies = null;

// ------------------------------------------------------------
// Small formatting helpers
// ------------------------------------------------------------

// Uppercases the first character, leaves the rest untouched.
function capitalizar(texto) {
  const limpio = String(texto == null ? "" : texto);
  if (!limpio) return "";
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

// Escapes user-facing text before injecting it as HTML.
function escaparHtml(texto) {
  return String(texto == null ? "" : texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// SWAPI sends "unknown" as a literal string for missing values.
function esDesconocido(valor) {
  const texto = String(valor == null ? "" : valor).trim().toLowerCase();
  return !texto || texto === "unknown" || texto === "n/a" || texto === "none";
}

// Height: SWAPI uses centimetres ("172") -> "1,72 m".
function formatearAltura(valor) {
  if (esDesconocido(valor)) return "Desconocida";
  const numero = Number(String(valor).trim());
  if (!Number.isFinite(numero)) return "Desconocida";
  return (numero / 100).toFixed(2).replace(".", ",") + " m";
}

// Mass: SWAPI uses kilograms ("77") -> "77 kg".
function formatearMasa(valor) {
  if (esDesconocido(valor)) return "Desconocida";
  const numero = Number(String(valor).trim());
  if (!Number.isFinite(numero)) return "Desconocida";
  return numero.toLocaleString("es-ES") + " kg";
}

// Generic text field ("blond" -> "Blond", "unknown" -> default label).
function formatearTexto(valor, porDefecto = "Desconocido") {
  if (esDesconocido(valor)) return porDefecto;
  return capitalizar(String(valor).trim());
}

// Gender in neutral Spanish.
function generoEnEspanol(genero) {
  const mapa = {
    male: "Masculino",
    female: "Femenino",
    hermaphrodite: "Hermafrodita",
  };
  const texto = String(genero == null ? "" : genero).trim().toLowerCase();
  if (!texto || texto === "unknown" || texto === "n/a") return "";
  return mapa[texto] || capitalizar(texto);
}

// Translates a SWAPI species name to Spanish when known.
function nombreEspecie(nombre) {
  if (!nombre) return "Desconocida";
  return ESPECIES_ES[nombre] || nombre;
}

// ------------------------------------------------------------
// Generated avatar (inline SVG, no external images)
// ------------------------------------------------------------

// Deterministic string hash (djb2-like, 32-bit unsigned).
function hashNombre(texto) {
  const limpio = String(texto == null ? "" : texto);
  let hash = 5381;
  for (let i = 0; i < limpio.length; i++) {
    hash = ((hash << 5) + hash + limpio.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// "Luke Skywalker" -> "LS", "Yoda" -> "YO".
function inicialesDe(nombre) {
  const partes = String(nombre == null ? "" : nombre)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// Returns an inline SVG avatar with the character initials on a
// deterministic coloured circle. Decorative: the name is always adjacent.
function avatarDe(nombre, tamano = 96) {
  const iniciales = escaparHtml(inicialesDe(nombre));
  const color = PALETA_AVATAR[hashNombre(nombre) % PALETA_AVATAR.length];

  return (
    '<svg class="sw-avatar" viewBox="0 0 96 96" width="' +
    tamano +
    '" height="' +
    tamano +
    '" aria-hidden="true" focusable="false">' +
    '<circle cx="48" cy="48" r="46" fill="' +
    color +
    '" />' +
    '<text x="48" y="50" text-anchor="middle" dominant-baseline="middle" ' +
    'font-family="Segoe UI, system-ui, sans-serif" font-size="34" font-weight="700" ' +
    'fill="#05070d">' +
    iniciales +
    "</text>" +
    "</svg>"
  );
}

// ------------------------------------------------------------
// Extras (async, cached)
// ------------------------------------------------------------

// Resolves homeworld + species + films for a person, once, with caching.
async function obtenerExtras(person) {
  if (!person) return { homeworld: "Desconocido", species: "unknown", films: [] };
  if (cacheExtras.has(person.name)) return cacheExtras.get(person.name);

  const resultados = await Promise.all([
    getHomeworld(person).catch(function () {
      return "unknown";
    }),
    getPersonSpecies(person).catch(function () {
      return "unknown";
    }),
    getFilms(person).catch(function () {
      return [];
    }),
  ]);

  const extra = {
    homeworld: resultados[0],
    species: resultados[1],
    films: resultados[2],
  };

  cacheExtras.set(person.name, extra);
  return extra;
}

// Returns the species catalogue through a one-time cache.
async function obtenerEspecies() {
  if (cacheEspecies) return cacheEspecies;
  try {
    cacheEspecies = await getSpeciesList();
  } catch (error) {
    cacheEspecies = [];
  }
  return cacheEspecies;
}

// ------------------------------------------------------------
// Rendering
// ------------------------------------------------------------

// Builds the badge row: birth year, gender, homeworld and species.
function crearBadges(person, extra) {
  const datos = extra || {};
  const badges = [];

  if (!esDesconocido(person.birth_year)) {
    badges.push(
      '<span class="sw-badge sw-badge--blue">' +
        escaparHtml(String(person.birth_year).trim()) +
        "</span>"
    );
  }

  const genero = generoEnEspanol(person.gender);
  if (genero) {
    badges.push('<span class="sw-badge sw-badge--purple">' + genero + "</span>");
  }

  if (datos.homeworld && !esDesconocido(datos.homeworld)) {
    badges.push(
      '<span class="sw-badge sw-badge--orange">' +
        escaparHtml(datos.homeworld) +
        "</span>"
    );
  }

  if (datos.species && !esDesconocido(datos.species)) {
    badges.push(
      '<span class="sw-badge sw-badge--green">' +
        escaparHtml(nombreEspecie(datos.species)) +
        "</span>"
    );
  }

  return badges.join("");
}

// Returns the HTML for one character card.
function crearCardPersonaje(person, extra) {
  if (!person) return "";

  const id = extractId(person.url);
  const nombre = escaparHtml(person.name);

  return (
    '<article class="sw-card personaje-card">' +
    '<div class="personaje-card-avatar">' +
    avatarDe(person.name) +
    "</div>" +
    '<h3 class="card-title">' +
    nombre +
    "</h3>" +
    '<div class="sw-badge-row">' +
    crearBadges(person, extra) +
    "</div>" +
    '<button class="sw-btn small ver-detalles" type="button" data-id="' +
    id +
    '">Ver detalles</button>' +
    "</article>"
  );
}

// Paints the list of { person, extra } items into a grid container.
function pintarPersonajes(container, lista) {
  const destino =
    typeof container === "string" ? document.getElementById(container) : container;
  if (!destino) return;

  if (!Array.isArray(lista) || lista.length === 0) {
    mostrarMensaje(destino, "No hay personajes que coincidan con los filtros.", "info");
    return;
  }

  destino.innerHTML = lista
    .map(function (item) {
      return crearCardPersonaje(item.person, item.extra);
    })
    .join("");
}

// Paints a status message inside the grid. tipo: "loading" | "error" | "info".
function mostrarMensaje(container, texto, tipo = "info") {
  const destino =
    typeof container === "string" ? document.getElementById(container) : container;
  if (!destino) return;

  const clase =
    tipo === "error" ? "error-msg" : tipo === "loading" ? "loading" : "mensaje-info";

  destino.innerHTML = '<p class="' + clase + '">' + escaparHtml(texto) + "</p>";
}

// Fills the Bootstrap modal body with the character detail.
function rellenarDetalle(person, extra) {
  const cuerpo = document.getElementById("modal-personaje-cuerpo");
  if (!cuerpo || !person) return;

  const datos = extra || {};
  const peliculas = Array.isArray(datos.films) ? datos.films : [];

  const listaPeliculas = peliculas.length
    ? '<ul class="modal-film-list">' +
      peliculas
        .map(function (titulo) {
          return "<li>" + escaparHtml(titulo) + "</li>";
        })
        .join("") +
      "</ul>"
    : '<p class="card-text">Sin películas registradas.</p>';

  const especie = datos.species && !esDesconocido(datos.species)
    ? nombreEspecie(datos.species)
    : "Desconocida";

  const planeta = datos.homeworld && !esDesconocido(datos.homeworld)
    ? datos.homeworld
    : "Desconocido";

  cuerpo.innerHTML =
    '<div class="modal-detalle-cabecera">' +
    avatarDe(person.name, 72) +
    "<div>" +
    '<h3 class="card-title">' +
    escaparHtml(person.name) +
    "</h3>" +
    '<p class="card-text">' +
    escaparHtml(especie) +
    "</p>" +
    "</div>" +
    "</div>" +
    '<ul class="modal-detail-list">' +
    "<li><strong>Altura:</strong> " +
    formatearAltura(person.height) +
    "</li>" +
    "<li><strong>Masa:</strong> " +
    formatearMasa(person.mass) +
    "</li>" +
    "<li><strong>Cabello:</strong> " +
    formatearTexto(person.hair_color) +
    "</li>" +
    "<li><strong>Ojos:</strong> " +
    formatearTexto(person.eye_color) +
    "</li>" +
    "<li><strong>Nacimiento:</strong> " +
    formatearTexto(person.birth_year) +
    "</li>" +
    "<li><strong>Género:</strong> " +
    (generoEnEspanol(person.gender) || "Desconocido") +
    "</li>" +
    "<li><strong>Planeta natal:</strong> " +
    escaparHtml(planeta) +
    "</li>" +
    "<li><strong>Especie:</strong> " +
    escaparHtml(especie) +
    "</li>" +
    "</ul>" +
    '<h4 class="modal-subtitle">Películas</h4>' +
    listaPeliculas;

  // Keep the dialog label in sync so the content is announced correctly.
  const titulo = document.getElementById("modal-personaje-titulo");
  if (titulo) titulo.textContent = person.name;
}
