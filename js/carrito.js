/* =========================================================
   CARRITO.JS
   ---------------------------------------------------------
   Pantalla "Tu pedido": el cliente revisa y corrige el pedido
   antes de enviarlo por WhatsApp. Controla la compra mínima.

   Usa las funciones del carrito que están en app.js.
   La compra mínima se configura en cliente/config.js (sección pedido)
   y las palabras reservadas (send, unlock) en palabrasReservadas.
   ========================================================= */

(function () {

  const COMPRA_MINIMA = Number(CLIENTE.pedido?.compraMinima) || 0;
  // Se habilita con la palabra reservada "send" y vale para un pedido:
  // sin compra mínima, y el botón copia el ticket y deja elegir el contacto
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
    // Con el mismo total redondeado que ve el cliente
    return Math.max(0, COMPRA_MINIMA - roundToHundreds(totalDelPedido()));
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
      const renglon = nodo("span", "pedidoDetalle", detalle);
      // Con oferta: "🔥 $699 c/u  $899" (el precio normal tachado)
      if (forma.oferta) {
        renglon.prepend(forma.oferta.tipo === "hoy" ? "🔥 " : "🏷️ ");
        renglon.append(" ", nodo("s", "pedidoAntes", formatter.format(forma.oferta.antes)));
      }
      info.appendChild(renglon);

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
    enviar.textContent = enviarSinMinimo
      ? "Copiar pedido y elegir contacto"
      : "Enviar pedido por WhatsApp";
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
    if (enviarSinMinimo) {
      compartirPedido();
      return;
    }

    updateWhatsAppLink();
    window.open(globalWhatsAppUrl, "_blank", "noopener,noreferrer");

    // Lo que compró queda como favorito para la próxima (js/favoritos.js)
    if (typeof agregarAFavoritos === "function") agregarAFavoritos(Object.keys(cart));

    cerrarHoja();
    clearCart();
    enviarSinMinimo = false;
  }


  // Modo "send": copia el ticket armado y abre el menú de compartir del
  // celular para elegir a quién mandarlo (no se manda al WhatsApp de la
  // distribuidora). Si el navegador no tiene ese menú, abre WhatsApp para
  // elegir el contacto.
  async function compartirPedido() {
    updateWhatsAppLink();
    const texto = textoPedidoArmado;
    if (!texto) return;

    // Copiado al portapapeles, por si lo querés pegar en otro lado
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(texto).catch(() => {});

    if (navigator.share) {
      try {
        await navigator.share({ text: texto });
      } catch (error) {
        // Cerró el menú sin elegir: el pedido queda armado (y copiado)
        if (error && error.name === "AbortError") {
          mostrarAvisoCarrito(["El pedido quedó copiado. Podés pegarlo en el chat que quieras."], "Pedido copiado");
          return;
        }
        abrirWhatsAppSinNumero(texto);
      }
    } else {
      abrirWhatsAppSinNumero(texto);
    }

    cerrarHoja();
    clearCart();
    enviarSinMinimo = false;
    window.actualizarAvisoMinimo();
  }

  function abrirWhatsAppSinNumero(texto) {
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  }


  /* ---------------- PALABRAS RESERVADAS ---------------- */
  // Escritas en el buscador (cliente/config.js → palabrasReservadas).
  // "quiebre" la maneja app.js (muestra los productos sin stock).

  function limpiarBuscador() {
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  searchInput.addEventListener("input", () => {
    const texto = searchInput.value;

    // send: pedido sin mínimo, se copia y se elige el contacto
    if (esPalabraReservada(texto, "enviarIgual")) {
      enviarSinMinimo = true;
      limpiarBuscador();
      window.actualizarAvisoMinimo();
      mostrarAvisoCarrito(
        ["Podés armar el pedido aunque no llegue al mínimo. Al tocar el botón se copia el ticket y elegís a quién mandarlo."],
        "Pedido sin compra mínima"
      );
      return;
    }

    // unlock: todos los productos sin stock pasan a disponibles
    if (esPalabraReservada(texto, "desbloquear")) {
      const cantidad = desbloquearSinStock();
      limpiarBuscador();
      mostrarAvisoCarrito(
        [cantidad
          ? `${cantidad} productos sin stock ahora se pueden agregar (hasta cerrar la app).`
          : "Los productos sin stock ya estaban habilitados."],
        "Productos desbloqueados"
      );
    }
  });


  /* ---------------- BOTÓN DEL PIE ---------------- */

  if (footerBoton) footerBoton.addEventListener("click", abrirHoja);

  window.actualizarAvisoMinimo();

})();
