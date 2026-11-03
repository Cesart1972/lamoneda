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
   - Como no hay buscador: botón grande "Ver categorías" arriba de los
     productos y, al deslizar, el botón flotante "Categorías". Los dos
     abren la lista de categorías a pantalla completa: un toque y va
     directo a esa parte del catálogo.

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
    if (flotante) flotante.hidden = true;
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

  /* ---------------- CATEGORÍAS ---------------- */
  // Botón grande arriba, botón flotante al deslizar y la lista

  let lista = null;
  let flotante = null;

  function crearBotonesCategorias() {
    const grilla = document.getElementById("productGrid");
    if (!grilla) return;

    const arriba = document.createElement("button");
    arriba.type = "button";
    arriba.className = "simpleCategorias";
    arriba.innerHTML = `<span aria-hidden="true">📋</span> Ver categorías`;
    arriba.onclick = abrirLista;
    grilla.before(arriba);

    flotante = document.createElement("button");
    flotante.type = "button";
    flotante.className = "simpleCategoriasFlotante";
    flotante.innerHTML = `<span aria-hidden="true">📋</span> Categorías`;
    flotante.onclick = abrirLista;
    flotante.hidden = true;
    document.body.appendChild(flotante);

    // El flotante aparece cuando el botón de arriba ya no se ve
    window.addEventListener("scroll", () => {
      flotante.hidden = !estaEnModoSimple() || arriba.getBoundingClientRect().bottom > 0;
    }, { passive: true });
  }

  function abrirLista() {
    if (!lista) {
      lista = document.createElement("div");
      lista.className = "simpleListaVelo";
      lista.setAttribute("role", "dialog");
      lista.setAttribute("aria-modal", "true");
      lista.setAttribute("aria-label", "Categorías");
      document.body.appendChild(lista);
      document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") cerrarLista();
      });
    }

    lista.innerHTML = `
      <div class="simpleListaCabecera">
        <h2>Categorías</h2>
        <button type="button" class="simpleListaCerrar" aria-label="Cerrar">✕</button>
      </div>
      <ul class="simpleListaCategorias"></ul>`;
    lista.querySelector(".simpleListaCerrar").onclick = cerrarLista;

    const ul = lista.querySelector("ul");
    document.querySelectorAll("#productGrid .catalogoSeparador").forEach(barra => {
      const item = document.createElement("li");
      const boton = document.createElement("button");
      boton.type = "button";
      const nombre = document.createElement("span");
      nombre.textContent = barra.dataset.nombre || barra.textContent.trim();
      boton.appendChild(nombre);
      if (barra.dataset.cantidad) {
        const cantidad = document.createElement("small");
        cantidad.textContent = barra.dataset.cantidad;
        boton.appendChild(cantidad);
      }
      boton.onclick = () => {
        cerrarLista();
        const arriba = barra.getBoundingClientRect().top + window.scrollY - 8;
        window.scrollTo({ top: arriba, behavior: "auto" });
      };
      item.appendChild(boton);
      ul.appendChild(item);
    });

    lista.hidden = false;
    document.body.classList.add("pedidoAbierto");   // sin scroll de fondo
  }

  function cerrarLista() {
    if (!lista || lista.hidden) return;
    lista.hidden = true;
    document.body.classList.remove("pedidoAbierto");
  }

  function iniciar() {
    crearBoton();
    crearBotonesCategorias();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
