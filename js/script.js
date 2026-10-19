// ============================================================
// script.js - Character explorer logic (application state).
// Decides what to fetch and when; dom.js paints the result.
// Two clearly jQuery-driven features live here:
//   1) live search + filters
//   2) detail modal with jQuery fade animation
// Bootstrap's own JS handles the modal show/hide.
// ============================================================

// How many pages and characters we load on first paint.
const PAGINAS_INICIALES = 2;
const MAX_PERSONAJES = 24;

// Maximum concurrent extra lookups (homeworld/films/species) so SWAPI
// is not hammered with dozens of parallel requests.
const LIMITE_CONCURRENCIA = 6;

// Module-level application state.
const estado = {
  personajes: [], // [{ person, extra }]
  cargando: false,
  listo: false,
};

// Bootstrap modal instance, created lazily once the DOM is ready.
let modalPersonaje = null;

// ------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------

// Is the character explorer grid present on this page?
function hayExplorador() {
  return document.getElementById("lista-personajes") !== null;
}

// Safe read of an input value by id.
function valorDe(id) {
  const elemento = document.getElementById(id);
  return elemento ? elemento.value : "";
}

// Announces a message through the polite live region.
function anunciar(texto) {
  const region = document.getElementById("resultado-personajes");
  if (region) region.textContent = texto;
}

// Updates the visible results counter.
function actualizarContador(total) {
  const visible = document.getElementById("contador-personajes");
  if (!visible) return;
  visible.textContent =
    total === 1 ? "1 personaje mostrado" : total + " personajes mostrados";
}

// Runs async tasks over a list with a concurrency ceiling.
async function mapaConLimite(lista, limite, tarea) {
  const resultados = new Array(lista.length);
  let indice = 0;

  async function trabajador() {
    while (indice < lista.length) {
      const actual = indice;
      indice += 1;
      resultados[actual] = await tarea(lista[actual], actual);
    }
  }

  const trabajadores = [];
  const total = Math.min(limite, lista.length);
  for (let i = 0; i < total; i++) {
    trabajadores.push(trabajador());
  }
  await Promise.all(trabajadores);
  return resultados;
}

// Builds the error state with a functional "Reintentar" button.
function mostrarError(contenedor, texto) {
  contenedor.innerHTML =
    '<p class="error-msg">' +
    escaparHtml(texto) +
    '</p><p class="error-msg error-msg--action">' +
    '<button class="sw-btn small primary reintentar" type="button">Reintentar</button>' +
    "</p>";
}

// ------------------------------------------------------------
// Data loading
// ------------------------------------------------------------

// Loads the first pages of people, resolves extras and renders.
async function cargarPersonajes() {
  const contenedor = document.getElementById("lista-personajes");
  if (!contenedor) return;
  if (estado.cargando) return;

  estado.cargando = true;
  mostrarMensaje(contenedor, "Cargando personajes...", "loading");
  anunciar("Cargando personajes...");

  try {
    const paginas = [];
    for (let pagina = 1; pagina <= PAGINAS_INICIALES; pagina++) {
      paginas.push(await getPeople(pagina));
    }

    // De-duplicate by id: swapi.info returns the full list on every page.
    const vistos = new Set();
    const personas = [];
    paginas.forEach(function (paginaActual) {
      (paginaActual.results || []).forEach(function (persona) {
        const id = extractId(persona.url);
        if (!vistos.has(id)) {
          vistos.add(id);
          personas.push(persona);
        }
      });
    });

    const recortados = personas.slice(0, MAX_PERSONAJES);

    const conExtras = await mapaConLimite(recortados, LIMITE_CONCURRENCIA, async function (
      persona
    ) {
      const extra = await obtenerExtras(persona);
      return { person: persona, extra: extra };
    });

    estado.personajes = conExtras;
    estado.listo = true;
    estado.cargando = false;
    aplicarFiltros();
  } catch (error) {
    estado.cargando = false;
    mostrarError(
      contenedor,
      "No se pudieron cargar los personajes. Revisa tu conexión e inténtalo de nuevo."
    );
    anunciar("Error al cargar los personajes.");
  }
}

// Loads the species catalogue and fills the filter select.
async function cargarEspecies() {
  const select = document.getElementById("filtro-especie");
  if (!select) return;

  const especies = await obtenerEspecies();
  const existentes = new Set();

  especies.forEach(function (especie) {
    if (existentes.has(especie.name)) return;
    existentes.add(especie.name);

    const opcion = document.createElement("option");
    opcion.value = especie.name;
    opcion.textContent = nombreEspecie(especie.name);
    select.appendChild(opcion);
  });
}

// ------------------------------------------------------------
// Filtering + rendering
// ------------------------------------------------------------

// Applies the current filters to the loaded list and paints the grid.
function aplicarFiltros() {
  const contenedor = document.getElementById("lista-personajes");
  if (!contenedor) return;

  const termino = valorDe("buscar-personaje").trim().toLowerCase();
  const especie = valorDe("filtro-especie");

  const filtrados = estado.personajes.filter(function (item) {
    const coincideNombre =
      !termino || item.person.name.toLowerCase().includes(termino);
    const coincideEspecie = !especie || (item.extra.species || "") === especie;
    return coincideNombre && coincideEspecie;
  });

  pintarPersonajes(contenedor, filtrados);
  actualizarContador(filtrados.length);
  anunciar(
    filtrados.length === 1
      ? "1 personaje cargado"
      : filtrados.length + " personajes cargados"
  );
}

// Resets every filter to its default value.
function limpiarFiltros() {
  const buscar = document.getElementById("buscar-personaje");
  const especie = document.getElementById("filtro-especie");
  if (buscar) buscar.value = "";
  if (especie) especie.value = "";
  aplicarFiltros();
}

// ------------------------------------------------------------
// jQuery wiring (live search + modal open/animation)
// ------------------------------------------------------------

function conectarEventos() {
  // jQuery #1: live search filters the loaded list as the user types.
  $("#buscar-personaje").on("input", function () {
    aplicarFiltros();
  });

  // Species filter (jQuery) refilters the already-loaded list client-side.
  $("#filtro-especie").on("change", function () {
    aplicarFiltros();
  });

  // Clear filters button.
  $("#limpiar-filtros").on("click", function (evento) {
    evento.preventDefault();
    limpiarFiltros();
    $("#buscar-personaje").trigger("focus");
  });

  // Retry button on the error state.
  $("#lista-personajes").on("click", ".reintentar", function () {
    cargarPersonajes();
  });

  // jQuery #2: delegated click opens the Bootstrap detail modal,
  // then animates the body with a jQuery fade.
  $("#lista-personajes").on("click", ".ver-detalles", async function () {
    const id = Number(this.dataset.id);
    const item = estado.personajes.find(function (entrada) {
      return extractId(entrada.person.url) === id;
    });
    if (!item) return;

    // Fill fields first; then refresh extras if the modal opens fast.
    rellenarDetalle(item.person, item.extra);

    if (modalPersonaje) {
      modalPersonaje.show();
    }

    const cuerpo = document.getElementById("modal-personaje-cuerpo");
    if (cuerpo) {
      $(cuerpo).hide().fadeIn(220);
    }

    // Resolve extras if they were still pending (defensive).
    try {
      const extra = await obtenerExtras(item.person);
      rellenarDetalle(item.person, extra);
    } catch (error) {
      // Keep whatever was already painted.
    }
  });
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------

$(function () {
  // Guard: only the Personajes page owns these elements.
  if (!hayExplorador()) return;

  const modalElemento = document.getElementById("modal-personaje");
  if (modalElemento && window.bootstrap) {
    modalPersonaje = new bootstrap.Modal(modalElemento);
  }

  conectarEventos();
  cargarEspecies();
  cargarPersonajes();
});
