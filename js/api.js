// ============================================================
// api.js - SWAPI data layer.
// Talks to swapi.dev first and falls back to swapi.info.
// Vanilla ES2017+ (async/await, fetch). No jQuery in this file.
// ============================================================

// Base URLs, tried in order. The first one that answers is remembered
// so later calls do not pay the cost of the dead host again.
const SWAPI_BASES = ["https://swapi.dev/api/", "https://swapi.info/api/"];

// Base that answered last, or null while none has answered yet.
let swapiBaseActiva = null;

// Resolved-resource cache: SWAPI URL -> parsed object.
// Planets, films and species repeat across characters, so this avoids
// refetching the same record many times while building the grid.
const swapiCache = new Map();

// Parses the trailing numeric id from a SWAPI URL.
// Accepts URLs with or without a trailing slash
// (swapi.dev uses ".../1/", swapi.info uses ".../1").
// Returns null when no numeric id is present.
function extractId(url) {
  if (typeof url === "number") return url;
  if (!url) return null;

  const partes = String(url).split("/").filter(Boolean);
  for (let i = partes.length - 1; i >= 0; i--) {
    const numero = Number(partes[i]);
    if (Number.isFinite(numero)) return numero;
  }
  return null;
}

// Turns a full SWAPI URL into a path relative to the API root.
// "https://swapi.dev/api/planets/1/" -> "planets/1/"
// "https://swapi.info/api/people/1"  -> "people/1"
function rutaRelativa(url) {
  const marca = "/api/";
  const indice = String(url).indexOf(marca);
  const ruta = indice >= 0 ? String(url).slice(indice + marca.length) : String(url);
  return ruta.replace(/^\/+/, "");
}

// Core request. Tries every base until one answers and returns parsed JSON.
// Throws a clear Spanish error only when all bases fail.
async function swapiGet(path) {
  const limpio = String(path).replace(/^\/+/, "");

  // Try the known-good base first, then the remaining ones.
  const bases = swapiBaseActiva
    ? [swapiBaseActiva].concat(
        SWAPI_BASES.filter(function (base) {
          return base !== swapiBaseActiva;
        })
      )
    : SWAPI_BASES.slice();

  let ultimoError = null;

  for (let i = 0; i < bases.length; i++) {
    const controlador = new AbortController();
    const temporizador = setTimeout(function () {
      controlador.abort();
    }, 8000);

    try {
      const respuesta = await fetch(bases[i] + limpio, {
        signal: controlador.signal,
      });
      if (!respuesta.ok) {
        throw new Error("HTTP " + respuesta.status);
      }
      const datos = await respuesta.json();
      swapiBaseActiva = bases[i];
      return datos;
    } catch (error) {
      ultimoError = error;
    } finally {
      clearTimeout(temporizador);
    }
  }

  throw new Error(
    "No se pudo conectar con SWAPI. Revisa tu conexión e inténtalo de nuevo."
  );
}

// Fetches a full SWAPI URL (planet, film, species) using the shared cache.
async function swapiGetUrl(url) {
  if (!url) return null;
  if (swapiCache.has(url)) return swapiCache.get(url);

  const datos = await swapiGet(rutaRelativa(url));
  swapiCache.set(url, datos);
  return datos;
}

// ------------------------------------------------------------
// PEOPLE
// ------------------------------------------------------------

// Returns one page of people, always as { count, results }.
// swapi.dev responds with {count, next, previous, results[]};
// swapi.info responds with a flat array for list endpoints.
async function getPeople(page = 1) {
  const datos = await swapiGet("people/?page=" + page);

  if (Array.isArray(datos)) {
    return { count: datos.length, results: datos };
  }

  return {
    count: typeof datos.count === "number" ? datos.count : 0,
    results: Array.isArray(datos.results) ? datos.results : [],
  };
}

// Returns a single person from a numeric id or a full SWAPI URL.
async function getPerson(idOrUrl) {
  const id = extractId(idOrUrl);
  if (!id) {
    throw new Error("Personaje no válido.");
  }
  return swapiGet("people/" + id + "/");
}

// ------------------------------------------------------------
// SPECIES
// ------------------------------------------------------------

// Returns the species catalogue as [{ name, url }].
// Handles both the paginated and the flat-array API shapes.
async function getSpeciesList() {
  const datos = await swapiGet("species/");
  const lista = Array.isArray(datos) ? datos : datos.results || [];

  return lista
    .filter(function (especie) {
      return especie && especie.name;
    })
    .map(function (especie) {
      return { name: especie.name, url: especie.url };
    });
}

// Returns the species NAME of a person.
// SWAPI represents Humans with an empty species array, so that is the default.
async function getPersonSpecies(person) {
  if (!person) return "unknown";

  const especies = Array.isArray(person.species) ? person.species : [];
  if (especies.length === 0) return "Human";

  const datos = await swapiGetUrl(especies[0]);
  return (datos && datos.name) || "unknown";
}

// ------------------------------------------------------------
// PLANETS + FILMS
// ------------------------------------------------------------

// Returns the person's homeworld PLANET NAME.
async function getHomeworld(person) {
  if (!person || !person.homeworld) return "unknown";

  const datos = await swapiGetUrl(person.homeworld);
  return (datos && datos.name) || "unknown";
}

// Returns an array with the TITLES of the films the person appears in.
async function getFilms(person) {
  if (!person || !Array.isArray(person.films) || person.films.length === 0) {
    return [];
  }

  const peliculas = await Promise.all(
    person.films.map(function (url) {
      return swapiGetUrl(url).catch(function () {
        return null;
      });
    })
  );

  return peliculas
    .filter(function (peli) {
      return peli && peli.title;
    })
    .map(function (peli) {
      return peli.title;
    });
}
