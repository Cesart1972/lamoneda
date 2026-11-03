/* =========================================================
   ANALITICA.JS
   ---------------------------------------------------------
   Píxel de Meta (Facebook / Instagram) y Google Analytics 4.

   Los números de cada distribuidora van en cliente/config.js
   → medicion. Si un número está vacío, ese servicio no se carga.

   Qué se mide (Meta / Google):
   - Entrada a la app ............ PageView / page_view
   - Búsqueda (3 letras o más) ... Search / search
   - Agregar un producto ......... AddToCart / add_to_cart
   - Abrir "Ver pedido" .......... InitiateCheckout / begin_checkout
   - Mandar el pedido por WA ..... Purchase / purchase (con el total)
   - Botón flotante de WhatsApp .. Contact / contact

   No se mide:
   - En la computadora de desarrollo (localhost, 127.0.0.1, archivo).
   - Mientras se arma un pedido con "order" (es el vendedor).
   - En el celular donde se escribió la palabra "nomedir" en el
     buscador (para no contarte a vos mismo). Se vuelve a medir
     escribiéndola otra vez.
   - Las palabras reservadas que se escriben en el buscador.

   Se carga en el <head>, después de cliente/config.js.
   ========================================================= */

(function () {
  const config = (typeof CLIENTE !== "undefined" && CLIENTE.medicion) || {};
  const metaId = String(config.metaPixelId || "").trim();
  const googleId = String(config.googleAnalyticsId || "").trim();
  const moneda = config.moneda || "ARS";
  const NO_MEDIR_KEY = "noMedir";

  function leerNoMedir() {
    try { return localStorage.getItem(NO_MEDIR_KEY) === "1"; } catch (error) { return false; }
  }

  const enDesarrollo =
    location.protocol === "file:" ||
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
    location.hostname.endsWith(".localhost");

  const activa = Boolean(metaId || googleId) && !enDesarrollo && !leerNoMedir();

  /* ---------------- CARGA DE LOS SERVICIOS ---------------- */

  if (activa && metaId) {
    /* Código oficial del Píxel de Meta */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0";
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", metaId);
    fbq("track", "PageView");
  }

  if (activa && googleId) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(googleId);
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag("js", new Date());
    gtag("config", googleId);   // manda el page_view solo
  }

  /* ---------------- ENVÍO DE EVENTOS ---------------- */

  // Vendedor armando un pedido: no es un cliente
  function puedeMedir() {
    if (!activa || leerNoMedir()) return false;
    if (typeof armadoActivo === "function" && armadoActivo()) return false;
    return true;
  }

  function meta(evento, datos) {
    if (metaId && typeof window.fbq === "function") window.fbq("track", evento, datos || {});
  }

  function google(evento, datos) {
    if (googleId && typeof window.gtag === "function") window.gtag("event", evento, datos || {});
  }

  function redondear(numero) {
    return Math.round(Number(numero) || 0);
  }

  // Un producto del carrito con su cantidad y su precio de ese momento
  function itemDe(id, cantidad) {
    const producto = typeof productoPorId === "function" ? productoPorId(id) : null;
    if (!producto) return null;
    let precio = Number(producto.price) || 0;
    try {
      if (typeof precioUnitarioEnCarrito === "function") precio = precioUnitarioEnCarrito(producto);
    } catch (error) { /* queda el precio de lista */ }
    return {
      item_id: String(producto.Id),
      item_name: producto.name,
      item_brand: producto.brand || undefined,
      item_category: producto.category || undefined,
      price: redondear(precio),
      quantity: Number(cantidad) || 1
    };
  }

  function itemsDelCarrito() {
    if (typeof cart === "undefined") return [];
    return Object.entries(cart)
      .map(([id, cantidad]) => itemDe(id, cantidad))
      .filter(Boolean);
  }

  function totalDe(items) {
    return items.reduce((suma, item) => suma + item.price * item.quantity, 0);
  }

  function enviarMeta(evento, items, valor) {
    meta(evento, {
      content_ids: items.map(item => item.item_id),
      content_type: "product",
      contents: items.map(item => ({ id: item.item_id, quantity: item.quantity })),
      num_items: items.reduce((suma, item) => suma + item.quantity, 0),
      value: redondear(valor),
      currency: moneda
    });
  }

  function enviarGoogle(evento, items, valor, extra) {
    google(evento, Object.assign({ currency: moneda, value: redondear(valor), items }, extra || {}));
  }

  /* ---------------- AGREGAR AL CARRITO ---------------- */
  // Se compara el carrito antes y después de cada cambio, así se cuenta
  // igual se agregue desde la tarjeta, el carrusel, los avisos o el pedido.

  let carritoAnterior = null;

  function fotoDelCarrito() {
    return typeof cart === "undefined" ? {} : Object.assign({}, cart);
  }

  function alCambiarCarrito() {
    const ahora = fotoDelCarrito();
    const antes = carritoAnterior;
    carritoAnterior = ahora;
    if (!antes || !puedeMedir()) return;

    Object.keys(ahora).forEach(id => {
      if (antes[id]) return;   // ya estaba: solo cambió la cantidad
      const item = itemDe(id, ahora[id]);
      if (!item) return;
      const valor = item.price * item.quantity;
      enviarMeta("AddToCart", [item], valor);
      enviarGoogle("add_to_cart", [item], valor);
    });
  }

  /* ---------------- BÚSQUEDA ---------------- */
  // Se manda cuando deja de escribir (1,5 s), una vez por palabra

  let esperaBusqueda = null;
  let ultimaBusqueda = "";

  function esReservada(texto) {
    const palabras = (typeof CLIENTE !== "undefined" && CLIENTE.palabrasReservadas) || {};
    const limpio = texto.trim().toLowerCase();
    return Object.values(palabras).some(palabra => String(palabra).toLowerCase() === limpio);
  }

  function alBuscar(entrada) {
    clearTimeout(esperaBusqueda);
    const texto = entrada.value.trim();
    if (texto.length < 3 || esReservada(texto)) return;
    esperaBusqueda = setTimeout(() => {
      const actual = entrada.value.trim();
      if (actual !== texto || actual.toLowerCase() === ultimaBusqueda || !puedeMedir()) return;
      ultimaBusqueda = actual.toLowerCase();
      meta("Search", { search_string: actual });
      google("search", { search_term: actual });
    }, 1500);
  }

  /* ---------------- "nomedir": no contar este celular ---------------- */

  function alternarNoMedir(entrada) {
    let apagada = !leerNoMedir();
    try { localStorage.setItem(NO_MEDIR_KEY, apagada ? "1" : "0"); } catch (error) { apagada = false; }
    entrada.value = "";
    entrada.dispatchEvent(new Event("input", { bubbles: true }));
    if (typeof mostrarAvisoCarrito === "function") {
      mostrarAvisoCarrito(
        [apagada
          ? "Desde este celular ya no se cuentan visitas ni pedidos en Meta y Google."
          : "Este celular vuelve a contarse en Meta y Google (desde la próxima vez que abras la app)."],
        apagada ? "Medición apagada" : "Medición encendida"
      );
    }
  }

  /* ---------------- PEDIDO ---------------- */

  // Lo llama js/carrito.js al abrir la hoja y al mandar el pedido
  window.analitica = {
    pedidoAbierto() {
      if (!puedeMedir()) return;
      const items = itemsDelCarrito();
      if (!items.length) return;
      const total = totalDe(items);
      enviarMeta("InitiateCheckout", items, total);
      enviarGoogle("begin_checkout", items, total);
    },

    pedidoEnviado(total) {
      if (!puedeMedir()) return;
      const items = itemsDelCarrito();
      if (!items.length) return;
      const valor = Number(total) > 0 ? Number(total) : totalDe(items);
      enviarMeta("Purchase", items, valor);
      enviarGoogle("purchase", items, valor, { transaction_id: "P" + Date.now() });
    }
  };

  /* ---------------- INICIO ---------------- */

  function iniciar() {
    carritoAnterior = fotoDelCarrito();
    document.addEventListener("carritocambio", alCambiarCarrito);

    const entrada = document.getElementById("searchInput");
    if (entrada) {
      entrada.addEventListener("input", () => {
        const palabra = (typeof CLIENTE !== "undefined" && CLIENTE.palabrasReservadas?.noMedir) || "";
        if (palabra && entrada.value.trim().toLowerCase() === palabra.toLowerCase()) {
          alternarNoMedir(entrada);
          return;
        }
        alBuscar(entrada);
      });
    }

    const botonWhatsApp = document.getElementById("whatsappBtn");
    if (botonWhatsApp) {
      botonWhatsApp.addEventListener("click", () => {
        if (!puedeMedir()) return;
        meta("Contact");
        google("contact", { method: "whatsapp" });
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
