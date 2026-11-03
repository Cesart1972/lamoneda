/* =========================================================
   MODO-SIMPLE.JS
   ---------------------------------------------------------
   Modo SIMPLE: para la gente a la que le cuesta usar la app.

   Se prende y se apaga con el botón "Simple" del encabezado.
   Con el modo simple:
   - Del encabezado quedan solo el logo y el botón "Modo SIMPLE"
     (encendido; tocándolo se vuelve al modo normal).
   - Se saca todo lo demás: carrusel de ofertas, buscador, chips,
     contador de productos, corazones, íconos, mensajes que tapan
     huecos y el botón flotante de WhatsApp.
   - Quedan las barras de categoría y los productos, uno por renglón
     y más grandes, sin posters (todas las variedades sueltas). El
     cliente solo desliza.
   - Cada producto con sus precios en columnas, cada una con su
     botón y su step (ver app.js → prepararFormasDeCompra).
   - El pie "Ver pedido" sigue igual, para mandar el pedido.

   Queda guardado en el celular (se abre en el mismo modo).
   Se carga ANTES de app.js, así la primera vez ya se dibuja en el
   modo que corresponde (sin parpadeo).
   ========================================================= */

const MODO_SIMPLE_KEY = "modoSimple";

function estaEnModoSimple() {
  return document.documentElement.classList.contains("modoSimple");
}

(function () {
  try {
    if (localStorage.getItem(MODO_SIMPLE_KEY) === "1") {
      document.documentElement.classList.add("modoSimple");
    }
  } catch (error) { /* sin almacenamiento: modo normal */ }

  let boton = null;

  function pintarBoton() {
    if (!boton) return;
    const simple = estaEnModoSimple();
    boton.classList.toggle("activo", simple);
    boton.setAttribute("aria-pressed", String(simple));
    boton.querySelector(".simpleTexto").textContent = simple ? "Modo SIMPLE" : "Simple";
    boton.title = simple ? "Volver al modo normal" : "Ver la app más simple";
  }

  // Al entrar: sin búsqueda ni chips (no se ven en el modo simple)
  function limpiarFiltros() {
    if (typeof searchInput !== "undefined" && searchInput) searchInput.value = "";
    if (typeof chipsActivos !== "undefined" && chipsActivos.length) {
      chipsActivos = [];
      document.querySelectorAll(".chip.activo").forEach(chip => {
        chip.classList.remove("activo");
        chip.setAttribute("aria-pressed", "false");
      });
      const enBuscador = document.getElementById("chipsEnBuscador");
      if (enBuscador) {
        enBuscador.replaceChildren();
        enBuscador.hidden = true;
      }
      searchInput.style.paddingRight = "";
    }
    const borrar = document.getElementById("clearSearchBtn");
    if (borrar) borrar.classList.add("hidden");
    const sugerencias = document.getElementById("searchSuggestions");
    if (sugerencias) sugerencias.hidden = true;
  }

  function cambiar() {
    const simple = !estaEnModoSimple();
    document.documentElement.classList.toggle("modoSimple", simple);
    try {
      localStorage.setItem(MODO_SIMPLE_KEY, simple ? "1" : "0");
    } catch (error) { /* sin almacenamiento */ }
    if (simple) limpiarFiltros();
    pintarBoton();
    handleFilterPipeline();
    window.scrollTo(0, 0);
  }

  function crearBoton() {
    const acciones = document.querySelector(".headerAcciones");
    if (!acciones) return;
    boton = document.createElement("button");
    boton.type = "button";
    boton.id = "btnSimple";
    boton.className = "btn-header btn-simple";
    boton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 9h10M7 13h10M7 17h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <span class="simpleTexto">Simple</span>`;
    boton.onclick = cambiar;
    acciones.prepend(boton);
    pintarBoton();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", crearBoton);
  else crearBoton();
})();
