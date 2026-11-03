/* =========================================================
   AVISOS.JS
   ---------------------------------------------------------
   "Avisarme" en los productos sin stock y la campanita de avisos
   del encabezado.

   - En la tarjeta de un producto sin stock, dentro del botón
     "Próximamente", a la derecha: la campanita roja "Avisarme".
     Tocada queda "Te aviso" (tocada otra vez, se cancela).
   - Cada vez que se abre la app con un products-data.js nuevo, si un
     producto que pidió que le avisen volvió a tener stock, se crea el
     aviso "¡Volvió!" (prioridad alta) y la campanita del encabezado
     muestra el número de avisos sin leer.
   - Tocando la campanita se abre la lista de avisos: arriba los de
     prioridad alta (reingresos), después los demás, del más nuevo al
     más viejo. Cada reingreso tiene "Ver" y "Agregar".

   Sin servidor: todo se guarda en el celular del cliente
   (localStorage "avisarme" y "avisos"). Los avisos solo aparecen al
   abrir la app, no como notificación del teléfono.

   Se carga ANTES de app.js (las tarjetas usan crearBotonAvisarme al
   dibujarse) y arma la campanita cuando la página terminó de cargar.
   ========================================================= */

const AVISARME_KEY = "avisarme";   // { [id]: fecha en que lo pidió }
const AVISOS_KEY = "avisos";       // [{ id, tipo, productoId, titulo, texto, fecha, leido, prioridad }]
const MAXIMO_AVISOS = 40;

function leerJSON(clave, vacio) {
  try {
    return JSON.parse(localStorage.getItem(clave)) || vacio;
  } catch (error) {
    return vacio;
  }
}

function guardarJSON(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch (error) { /* sin almacenamiento */ }
}

function pidioAviso(product) {
  return Boolean(leerJSON(AVISARME_KEY, {})[String(product.Id)]);
}

// Campanita "Avisarme" dentro del botón "Próximamente" (app.js la agrega
// a las tarjetas sin stock)
function crearBotonAvisarme(product) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "avisarmeBtn";

  const pintar = () => {
    const activo = pidioAviso(product);
    boton.classList.toggle("activo", activo);
    boton.setAttribute("aria-pressed", String(activo));
    boton.setAttribute("aria-label", activo
      ? `Te vamos a avisar cuando vuelva ${product.name}. Tocá para cancelar`
      : `Avisarme cuando vuelva ${product.name}`);
    boton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v3.6L4.3 15.4A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.6L18 12.6V9a6 6 0 0 0-6-6Z"/><path d="M9.8 19a2.3 2.3 0 0 0 4.4 0"/></svg>
      <span>${activo ? "Te aviso" : "Avisarme"}</span>`;
  };
  pintar();

  boton.onclick = evento => {
    evento.stopPropagation();
    const lista = leerJSON(AVISARME_KEY, {});
    const id = String(product.Id);
    if (lista[id]) delete lista[id];
    else lista[id] = new Date().toISOString();
    guardarJSON(AVISARME_KEY, lista);
    // Todas las tarjetas del mismo producto (ej. en el poster abierto)
    document.querySelectorAll(`.productCard[data-product-id="${CSS.escape(id)}"] .avisarmeBtn`)
      .forEach(otro => otro.dispatchEvent(new Event("repintar")));
    if (lista[id] && typeof mostrarAvisoCarrito === "function") {
      mostrarAvisoCarrito([`Cuando vuelva "${product.name}" te avisamos en la campanita de arriba.`], "🔔 Te vamos a avisar");
    }
  };
  boton.addEventListener("repintar", pintar);
  return boton;
}


(function () {

  /* ---------------- REINGRESOS ---------------- */
  // Al abrir la app: los productos pedidos que ya tienen stock pasan a avisos

  function revisarReingresos() {
    const pedidos = leerJSON(AVISARME_KEY, {});
    const avisos = leerJSON(AVISOS_KEY, []);
    let cambio = false;

    Object.keys(pedidos).forEach(id => {
      const product = productoPorId(id);
      if (!product) {
        // Ya no está en el catálogo
        delete pedidos[id];
        cambio = true;
        return;
      }
      if (!product.inStock || product.estabaSinStock) return;
      avisos.unshift({
        id: `reingreso-${id}-${Date.now()}`,
        tipo: "reingreso",
        prioridad: "alta",
        productoId: id,
        titulo: "¡Volvió!",
        texto: product.name,
        fecha: new Date().toISOString(),
        leido: false
      });
      delete pedidos[id];
      cambio = true;
    });

    if (cambio) {
      guardarJSON(AVISARME_KEY, pedidos);
      guardarJSON(AVISOS_KEY, avisos.slice(0, MAXIMO_AVISOS));
    }
  }


  /* ---------------- CAMPANITA DEL ENCABEZADO ---------------- */

  let boton = null;
  let panel = null;

  function sinLeer() {
    return leerJSON(AVISOS_KEY, []).filter(aviso => !aviso.leido).length;
  }

  function crearCampanita() {
    const acciones = document.querySelector(".headerAcciones");
    if (!acciones) return;
    boton = document.createElement("button");
    boton.type = "button";
    boton.id = "btnAvisos";
    boton.className = "btn-header btn-avisos";
    boton.innerHTML = `
      <span class="avisosIcono">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v3.6L4.3 15.4A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.6L18 12.6V9a6 6 0 0 0-6-6Z"/><path d="M9.8 19a2.3 2.3 0 0 0 4.4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <b class="avisosBadge" hidden></b>
      </span>
      <span>Avisos</span>`;
    boton.onclick = evento => {
      evento.stopPropagation();
      if (panel && !panel.hidden) cerrarPanel();
      else abrirPanel();
    };
    acciones.prepend(boton);
    actualizarBadge(true);
  }

  function actualizarBadge(animar) {
    if (!boton) return;
    const cantidad = sinLeer();
    const badge = boton.querySelector(".avisosBadge");
    badge.textContent = cantidad > 9 ? "9+" : String(cantidad);
    badge.hidden = cantidad === 0;
    boton.setAttribute("aria-label", cantidad ? `Avisos: ${cantidad} sin leer` : "Avisos");
    if (animar && cantidad) {
      boton.classList.remove("sonando");
      void boton.offsetWidth;
      boton.classList.add("sonando");
    }
  }


  /* ---------------- LISTA DE AVISOS ---------------- */

  function nodo(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);
    if (clase) elemento.className = clase;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
  }

  function cuando(fechaISO) {
    const fecha = new Date(fechaISO);
    const hoy = new Date();
    const hora = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    if (fecha.toDateString() === hoy.toDateString()) return `Hoy ${hora}`;
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    if (fecha.toDateString() === ayer.toDateString()) return `Ayer ${hora}`;
    return fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  }

  // Alta prioridad arriba; dentro de cada grupo, del más nuevo al más viejo
  function avisosOrdenados() {
    return leerJSON(AVISOS_KEY, []).slice().sort((a, b) =>
      (a.prioridad === "alta" ? 0 : 1) - (b.prioridad === "alta" ? 0 : 1) ||
      String(b.fecha).localeCompare(String(a.fecha)));
  }

  function construirPanel() {
    panel = nodo("div", "avisosPanel");
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Avisos");
    panel.addEventListener("click", evento => evento.stopPropagation());
    document.body.appendChild(panel);
    document.addEventListener("click", () => cerrarPanel());
    document.addEventListener("keydown", evento => {
      if (evento.key === "Escape") cerrarPanel();
    });
    window.addEventListener("resize", ubicarPanel);
  }

  // Debajo de la campanita, sin salirse de la pantalla
  function ubicarPanel() {
    if (!panel || panel.hidden || !boton) return;
    const caja = boton.getBoundingClientRect();
    panel.style.top = `${Math.round(caja.bottom + 8)}px`;
  }

  function abrirPanel() {
    if (!panel) construirPanel();
    dibujarPanel();
    panel.hidden = false;
    ubicarPanel();
    requestAnimationFrame(() => panel.classList.add("visible"));
    // Al abrir, se dan por leídos (los nuevos quedan marcados hasta cerrar)
    const avisos = leerJSON(AVISOS_KEY, []);
    if (avisos.some(aviso => !aviso.leido)) {
      guardarJSON(AVISOS_KEY, avisos.map(aviso => ({ ...aviso, leido: true })));
      actualizarBadge(false);
    }
  }

  function cerrarPanel() {
    if (!panel || panel.hidden) return;
    panel.classList.remove("visible");
    setTimeout(() => {
      if (!panel.classList.contains("visible")) panel.hidden = true;
    }, 180);
  }

  let nuevosDeEstaVez = new Set();

  function dibujarPanel() {
    const avisos = avisosOrdenados();
    if (panel.hidden) nuevosDeEstaVez = new Set(avisos.filter(aviso => !aviso.leido).map(aviso => aviso.id));

    panel.replaceChildren();
    const cabecera = nodo("div", "avisosCabecera");
    cabecera.appendChild(nodo("strong", "", "🔔 Avisos"));
    if (avisos.length) {
      const borrar = nodo("button", "avisosBorrarTodo", "Borrar todos");
      borrar.type = "button";
      borrar.onclick = () => {
        guardarJSON(AVISOS_KEY, []);
        actualizarBadge(false);
        dibujarPanel();
      };
      cabecera.appendChild(borrar);
    }
    panel.appendChild(cabecera);

    if (avisos.length === 0) {
      const pedidos = Object.keys(leerJSON(AVISARME_KEY, {})).length;
      panel.appendChild(nodo("p", "avisosVacio", pedidos
        ? `No hay avisos nuevos. Te estamos avisando de ${pedidos} ${pedidos === 1 ? "producto" : "productos"} sin stock.`
        : "No tenés avisos. En un producto sin stock tocá la campanita «Avisarme» y te avisamos acá cuando vuelva."));
      return;
    }

    const lista = nodo("ul", "avisosLista");
    avisos.forEach(aviso => lista.appendChild(crearAviso(aviso)));
    panel.appendChild(lista);
  }

  function crearAviso(aviso) {
    const item = nodo("li", `aviso aviso-${aviso.tipo}`);
    if (aviso.prioridad === "alta") item.classList.add("prioridadAlta");
    if (nuevosDeEstaVez.has(aviso.id)) item.classList.add("nuevo");

    const product = aviso.productoId ? productoPorId(aviso.productoId) : null;
    if (product) {
      const foto = nodo("img", "avisoFoto");
      foto.src = product.image || categoryImage(product.category);
      foto.alt = "";
      foto.loading = "lazy";
      foto.onerror = () => {
        foto.onerror = null;
        foto.src = categoryImage(product.category);
      };
      item.appendChild(foto);
    }

    const texto = nodo("div", "avisoTexto");
    const titulo = nodo("span", "avisoTitulo", aviso.titulo);
    if (nuevosDeEstaVez.has(aviso.id)) titulo.appendChild(nodo("span", "avisoNuevo", "Nuevo"));
    texto.append(titulo, nodo("span", "avisoNombre", product ? product.name : aviso.texto));
    if (product) {
      texto.appendChild(nodo("span", "avisoPrecio",
        `${formatter.format(precioActual(product))} c/u${product.inStock ? "" : " · otra vez sin stock"}`));
    }
    texto.appendChild(nodo("span", "avisoFecha", cuando(aviso.fecha)));
    item.appendChild(texto);

    const acciones = nodo("div", "avisoAcciones");
    if (product && product.inStock) {
      const ver = nodo("button", "avisoVer", "Ver");
      ver.type = "button";
      ver.onclick = () => irAlProducto(product);
      const enPedido = cart[idProducto(product)];
      const agregar = nodo("button", "avisoAgregar", enPedido ? "✓ En el pedido" : "Agregar");
      agregar.type = "button";
      agregar.disabled = Boolean(enPedido);
      agregar.onclick = () => {
        agregarAlCarrito(product, 1);
        saveCart();
        document.querySelectorAll(`.productCard:not(.posterCard)[data-product-id="${CSS.escape(idProducto(product))}"]`)
          .forEach(tarjeta => {
            updateCardControls(tarjeta, product, true);
            actualizarFormasDeCompra(tarjeta, product, false);
          });
        updateWhatsAppLink();
        updateCheckoutUI();
        dibujarPanel();
      };
      acciones.append(ver, agregar);
    }
    const quitar = nodo("button", "avisoQuitar", "×");
    quitar.type = "button";
    quitar.setAttribute("aria-label", "Borrar este aviso");
    quitar.onclick = () => {
      guardarJSON(AVISOS_KEY, leerJSON(AVISOS_KEY, []).filter(otro => otro.id !== aviso.id));
      actualizarBadge(false);
      dibujarPanel();
    };
    item.append(acciones, quitar);
    return item;
  }

  // Lleva a la tarjeta del producto (si está dentro de un poster, lo abre)
  function irAlProducto(product) {
    cerrarPanel();
    const id = idProducto(product);
    // Con búsqueda o chips, se vuelve a la lista completa
    if (!modoListaCompleta && typeof searchInput !== "undefined") {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const buscar = () => productGrid.querySelector(`.productCard:not(.posterCard)[data-product-id="${CSS.escape(id)}"]`);
    let tarjeta = buscar();
    if (!tarjeta) {
      for (const [posterId, variedades] of variedadesPorPoster) {
        if (!variedades.some(variedad => idProducto(variedad) === id)) continue;
        const poster = productGrid.querySelector(`.posterCard[data-poster-id="${CSS.escape(posterId)}"]`);
        if (poster && !poster.classList.contains("abierto")) abrirVariedades(poster, true);
        tarjeta = buscar();
        break;
      }
    }
    if (!tarjeta) return;
    tarjeta.scrollIntoView({ behavior: "smooth", block: "center" });
    tarjeta.classList.remove("destacadoSenalado");
    void tarjeta.offsetWidth;
    tarjeta.classList.add("destacadoSenalado");
    setTimeout(() => tarjeta.classList.remove("destacadoSenalado"), 1400);
  }


  /* ---------------- ARRANQUE ---------------- */

  function iniciar() {
    revisarReingresos();
    crearCampanita();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();

})();
