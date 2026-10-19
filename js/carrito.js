/* =========================================================
   CARRITO.JS
   ---------------------------------------------------------
   Pantalla "Tu pedido": el cliente revisa y corrige el pedido
   antes de enviarlo por WhatsApp. Controla la compra mínima.

   Usa las funciones del carrito que están en app.js.
   La compra mínima y la palabra escondida se configuran en
   cliente/config.js (sección pedido).
   ========================================================= */

(function () {

  const COMPRA_MINIMA = Number(CLIENTE.pedido?.compraMinima) || 0;
  const PALABRA_ENVIAR_IGUAL = String(CLIENTE.pedido?.palabraEnviarIgual || "").trim();

  // Se habilita con la palabra escondida y vale hasta cerrar la app
  let enviarSinMinimo = false;

  const footerBoton = document.getElementById("checkoutBtn");
  const avisoFooter = document.getElementById("avisoMinimoFooter");

  let hoja = null;


  /* ---------------- TOTAL Y COMPRA MÍNIMA ---------------- */

  function totalDelPedido() {
    let total = 0;
    Object.entries(cart).forEach(([id, unidades]) => {
      const product = productoPorId(id);
      if (product) total += precioUnitarioEnCarrito(product) * unidades;
    });
    return total;
  }

  function faltaParaElMinimo() {
    if (!COMPRA_MINIMA || enviarSinMinimo) return 0;
    return Math.max(0, COMPRA_MINIMA - totalDelPedido());
  }

  // app.js la llama cada vez que cambia el carrito (updateCheckoutUI)
  window.actualizarAvisoMinimo = function () {
    const falta = faltaParaElMinimo();
    if (avisoFooter) {
      avisoFooter.textContent = `Compra mínima ${formatter.format(COMPRA_MINIMA)}`;
      avisoFooter.hidden = falta <= 0;
    }
    if (hoja && !hoja.hidden) dibujarHoja();
  };


  /* ---------------- HOJA "TU PEDIDO" ---------------- */

  function nodo(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);
    if (clase) elemento.className = clase;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
  }

  function construirHoja() {
    hoja = nodo("div", "pedidoVelo");
    hoja.hidden = true;
    hoja.innerHTML = `
      <section class="pedidoHoja" role="dialog" aria-modal="true" aria-labelledby="pedidoTitulo" tabindex="-1">
        <header class="pedidoEncabezado">
          <h2 id="pedidoTitulo">Tu pedido</h2>
          <button type="button" class="pedidoCerrar" aria-label="Cerrar">✕</button>
        </header>
        <ul class="pedidoLista"></ul>
        <footer class="pedidoPie">
          <div class="pedidoTotal"><span>Total</span><strong class="pedidoTotalMonto"></strong></div>
          <div class="pedidoEnviarBloque">
            <button type="button" class="pedidoEnviar">Enviar pedido por WhatsApp</button>
            <p class="avisoMinimo pedidoAvisoMinimo" hidden></p>
          </div>
        </footer>
      </section>`;

    hoja.querySelector(".pedidoCerrar").onclick = cerrarHoja;
    hoja.querySelector(".pedidoEnviar").onclick = enviarPedido;
    hoja.addEventListener("click", evento => {
      if (evento.target === hoja) cerrarHoja();
    });
    document.addEventListener("keydown", evento => {
      if (evento.key === "Escape" && hoja && !hoja.hidden) cerrarHoja();
    });

    document.body.appendChild(hoja);
  }

  let temporizadorCierre = null;

  // La hoja sube desde abajo y el fondo se oscurece de a poco
  function abrirHoja() {
    if (Object.keys(cart).length === 0) return;
    if (!hoja) construirHoja();
    clearTimeout(temporizadorCierre);
    dibujarHoja();
    hoja.hidden = false;
    document.body.classList.add("pedidoAbierto");
    // En el cuadro siguiente, para que el navegador anime el cambio
    requestAnimationFrame(() => requestAnimationFrame(() => hoja.classList.add("visible")));
    hoja.querySelector(".pedidoHoja").focus({ preventScroll: true });
  }

  // Baja y se desvanece; recién después se oculta
  function cerrarHoja() {
    if (!hoja || hoja.hidden) return;
    hoja.classList.remove("visible");
    document.body.classList.remove("pedidoAbierto");
    clearTimeout(temporizadorCierre);
    temporizadorCierre = setTimeout(() => {
      if (!hoja.classList.contains("visible")) hoja.hidden = true;
    }, 760);   // lo que dura la bajada (css/carrito.css)
  }

  // Productos del carrito en el orden del catálogo
  function idsEnOrden() {
    return Object.keys(cart)
      .filter(id => cart[id] > 0 && productoPorId(id))
      .sort((a, b) =>
        (posicionEnCatalogo.get(a) ?? Infinity) - (posicionEnCatalogo.get(b) ?? Infinity)
      );
  }

  function dibujarHoja() {
    const lista = hoja.querySelector(".pedidoLista");
    lista.replaceChildren();

    idsEnOrden().forEach(id => {
      const product = productoPorId(id);
      const forma = formaEnCarrito(product);
      const unidades = cart[id];

      const fila = nodo("li", "pedidoFila");

      const info = nodo("div", "pedidoInfo");
      info.appendChild(nodo("span", "pedidoNombre", product.name));
      const detalle = formaConMedida(forma)
        ? `${unidades} u. · ${formatter.format(forma.precioUnitario)} c/u`
        : `${formatter.format(forma.precioUnitario)} c/u`;
      info.appendChild(nodo("span", "pedidoDetalle", detalle));

      const controles = nodo("div", "pedidoControles");
      const menos = nodo("button", "pedidoMenos", "−");
      menos.type = "button";
      menos.setAttribute("aria-label", `Quitar uno de ${product.name}`);
      menos.onclick = () => cambiar(product, -1, fila);

      const cantidad = nodo("span", "pedidoCantidad", textoCantidad(forma, unidades));

      const mas = nodo("button", "pedidoMas", "+");
      mas.type = "button";
      mas.setAttribute("aria-label", `Sumar uno de ${product.name}`);
      mas.onclick = () => cambiar(product, +1, fila);

      controles.append(menos, cantidad, mas);

      const derecha = nodo("div", "pedidoDerecha");
      derecha.appendChild(nodo("span", "pedidoSubtotal", formatter.format(forma.precioUnitario * unidades)));
      const quitar = nodo("button", "pedidoQuitar", "Quitar");
      quitar.type = "button";
      quitar.onclick = () => {
        quitarDelCarrito(id);
        animarSalida(fila, () => despuesDeCambiar(product));
      };
      derecha.appendChild(quitar);

      fila.append(info, derecha, controles);
      lista.appendChild(fila);
    });

    const total = totalDelPedido();
    hoja.querySelector(".pedidoTotalMonto").textContent = formatter.format(roundToHundreds(total));

    const falta = faltaParaElMinimo();
    const aviso = hoja.querySelector(".pedidoAvisoMinimo");
    const enviar = hoja.querySelector(".pedidoEnviar");
    enviar.disabled = falta > 0;
    aviso.hidden = falta <= 0;
    // Botón y renglón rojo forman un solo bloque
    hoja.querySelector(".pedidoEnviarBloque").classList.toggle("conAviso", falta > 0);
    aviso.textContent =
      `Compra mínima ${formatter.format(COMPRA_MINIMA)} · Te faltan ${formatter.format(falta)}`;
  }

  function cambiar(product, sentido, fila) {
    cambiarCantidadEnCarrito(product, sentido);
    // Si llegó a cero, la fila desaparece con una transición
    if (!cart[idProducto(product)] && fila) {
      animarSalida(fila, () => despuesDeCambiar(product));
      return;
    }
    despuesDeCambiar(product);
  }

  // La fila se achica y se desvanece; después se actualiza todo
  function animarSalida(fila, alTerminar) {
    if (fila.classList.contains("pedidoFilaSaliendo")) return;
    fila.style.height = `${fila.offsetHeight}px`;
    void fila.offsetHeight;
    fila.classList.add("pedidoFilaSaliendo");

    let listo = false;
    const terminar = () => {
      if (listo) return;
      listo = true;
      alTerminar();
    };
    fila.addEventListener("transitionend", terminar, { once: true });
    setTimeout(terminar, 400);
  }

  // Guarda, actualiza la tarjeta del catálogo, el total y la hoja
  function despuesDeCambiar(product) {
    saveCart();

    const tarjeta = document.querySelector(
      `.productCard[data-product-id="${CSS.escape(idProducto(product))}"]`
    );
    if (tarjeta) {
      updateCardControls(tarjeta, product, true);
      actualizarFormasDeCompra(tarjeta, product, false);
    }

    updateWhatsAppLink();
    updateCheckoutUI();

    if (Object.keys(cart).length === 0) {
      cerrarHoja();
    } else {
      dibujarHoja();
    }
  }

  function enviarPedido() {
    if (faltaParaElMinimo() > 0) return;

    updateWhatsAppLink();
    window.open(globalWhatsAppUrl, "_blank", "noopener,noreferrer");

    cerrarHoja();
    clearCart();
    enviarSinMinimo = false;
  }


  /* ---------------- PALABRA ESCONDIDA ---------------- */
  // Escrita en el buscador, habilita enviar por debajo del mínimo.

  if (PALABRA_ENVIAR_IGUAL) {
    searchInput.addEventListener("input", () => {
      if (normalize(searchInput.value) !== normalize(PALABRA_ENVIAR_IGUAL)) return;

      enviarSinMinimo = true;
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      window.actualizarAvisoMinimo();
      mostrarAvisoCarrito(
        ["Podés enviar el pedido aunque no llegue al mínimo (hasta cerrar la app)."],
        "Envío sin compra mínima"
      );
    });
  }


  /* ---------------- BOTÓN DEL PIE ---------------- */

  if (footerBoton) footerBoton.addEventListener("click", abrirHoja);

  window.actualizarAvisoMinimo();

})();
