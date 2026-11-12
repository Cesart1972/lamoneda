/* =========================================================
   CARRUSEL-OFERTAS.JS
   ---------------------------------------------------------
   Anillo 3D "Ofertas de hoy" debajo del encabezado y antes del
   buscador. Cada oferta "Solo x hoy" es una cara del anillo, que
   gira solo. No es sticky: se va al deslizar y se oculta al buscar
   o filtrar. Solo aparece los días que hay ofertas.

   Cómo se usa:
   - Arrastrar el dedo (más de 8 px) gira el anillo. Nunca elige.
   - Tocar mientras gira: lo frena y trae al frente la tarjeta tocada.
   - Con el anillo quieto, tocar una tarjeta de costado la trae al frente.
   - Con el anillo quieto aparece, debajo de la tarjeta del frente (afuera
     de la tarjeta, así no queda larga), el botón "Agregar": carga la
     oferta al pedido sin salir del carrusel, con su step. Después se
     convierte en − cantidad +. Si es un grupo (poster), "Elegir variedad"
     abre la lista de variedades acá mismo, cada una con su "Agregar".
   - Sin tocar nada durante 4 segundos, vuelve a girar solo.

   Deja de girar cuando no está en pantalla. Con "reducir movimiento"
   o en navegadores sin 3D se muestra como una fila plana deslizable,
   con el botón debajo de cada tarjeta.

   Configuración (cliente/config.js → carrusel):
   - visible: false lo apaga del todo (no se ve aunque haya ofertas).
   - imagenes: tabla de imágenes verticales de 1080 × 1920 (formato de
     estado/historia; carpeta imagenes/carrusel/) con fecha desde y hasta.
     Sin "desde" no se publica; sin "hasta" no termina. Cada imagen vigente
     es una cara más del anillo, del mismo alto que las tarjetas. Si tiene
     "buscar", debajo aparece "Ver productos", que busca ese texto.
   - Si hay imágenes pero ninguna oferta, el título pasa a tituloSinOfertas
     y no se muestra la cuenta regresiva.

   Usa ofertaDeHoy() y ofertaComunDeVariedades() de js/ofertas.js y
   agruparVariedades(), agregarAlCarrito(), cambiarCantidadEnCarrito(),
   modoListaCompleta... de app.js.
   ========================================================= */

(function () {

  const seccion = document.getElementById("ofertasHoy");
  if (!seccion) return;

  const ARRASTRE_MINIMO = 8;        // px para que cuente como arrastre
  const ESPERA_PARA_GIRAR = 4000;   // ms quieto antes de volver a girar
  const SEGUNDOS_POR_CARA = 3.2;    // velocidad del giro automático
  const MINIMO_ANILLO = 3;          // con menos caras, fila plana
  const MAXIMO_ANILLO = 12;         // con más caras, fila plana
  const PROPORCION_IMAGEN = 9 / 16; // ancho ÷ alto de las imágenes (1080 × 1920)
  const SEPARACION = 20;            // px entre cara y cara

  const ajustes = (typeof CLIENTE !== "undefined" && CLIENTE.carrusel) || {};
  const carruselVisible = ajustes.visible !== false;
  const carpetaImagenes = ajustes.carpeta || "imagenes/carrusel/";
  const imagenesQueFallaron = new Set();

  const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");
  const con3D = typeof CSS !== "undefined" && CSS.supports &&
    CSS.supports("transform-style", "preserve-3d") && CSS.supports("perspective", "1px");

  let items = [];
  let caras = [];
  let modoPlano = false;

  // Estado del anillo
  let angulo = 0;            // grados que giró el anillo
  let paso = 0;              // grados promedio entre cara y cara (velocidad del giro)
  let angulos = [];          // ángulo de cada cara (las imágenes son más anchas)
  let radio = 0;
  let estado = "girando";    // girando · arrastrando · inercia · llevando · quieto
  let velocidad = 0;         // grados por segundo (inercia)
  let destino = 0;           // ángulo al que se lleva el anillo
  let ultimoCuadro = 0;
  let cuadro = 0;
  let esperaGiro = 0;
  let enPantalla = true;
  let frente = -1;
  let variedadesAbiertas = -1;   // cara cuyo grupo muestra sus variedades

  const titulo = elemento("div", "ofertasHoyTitulo");
  const reloj = elemento("b", "ofertasHoyReloj");
  const nombreTitulo = elemento("span", "ofertasHoyNombre", ajustes.titulo || "🔥 Ofertas de hoy");
  const termina = elemento("span", "ofertasHoyTermina", "terminan en ");
  termina.appendChild(reloj);
  titulo.append(nombreTitulo, termina);

  const escena = elemento("div", "ofertasEscena");
  const anillo = elemento("div", "ofertasAnillo");
  escena.appendChild(anillo);

  // Botón de la tarjeta del frente (afuera de la tarjeta)
  const accion = elemento("div", "ofertasAccion");
  // Variedades de un grupo, para elegir sin salir del carrusel
  const panel = elemento("div", "ofertasVariedades");
  panel.hidden = true;
  const pista = elemento("p", "ofertasPista", "Deslizá para girar · tocá una tarjeta para traerla al frente");

  seccion.append(titulo, escena, accion, panel, pista);


  /* ---------------- QUÉ OFERTAS VAN ---------------- */
  // En el orden del catálogo. Un grupo (poster) con todas sus variedades
  // en oferta es una sola cara. Las agotadas van al final del giro.

  function armarItems() {
    const { grupos } = agruparVariedades(products);
    const posterDe = new Map();
    const postersConOferta = new Set();

    grupos.forEach((variedades, posterId) => {
      variedades.forEach(product => posterDe.set(idProducto(product), posterId));
      const oferta = ofertaComunDeVariedades(variedades);
      if (oferta && oferta.tipo === "hoy") postersConOferta.add(posterId);
    });

    const lista = [];
    products.forEach(product => {
      const id = idProducto(product);
      const tipo = tipoMuestra(product);
      if (tipo === "poster" && postersConOferta.has(id)) {
        const variedades = grupos.get(id) || [];
        lista.push({
          tipo: "poster",
          product,
          variedades,
          oferta: ofertaComunDeVariedades(variedades),
          agotado: variedades.every(variedad => !variedad.inStock)
        });
      } else if (tipo === "producto") {
        const oferta = ofertaDeHoy(product);
        if (!oferta || postersConOferta.has(posterDe.get(id))) return;
        lista.push({ tipo: "producto", product, oferta, agotado: !product.inStock });
      }
    });

    const ofertas = [...lista.filter(item => !item.agotado), ...lista.filter(item => item.agotado)];
    const imagenes = imagenesVigentes();
    return ajustes.imagenesPrimero === false ? [...ofertas, ...imagenes] : [...imagenes, ...ofertas];
  }

  /* ---------------- IMÁGENES (config → carrusel.imagenes) ---------------- */
  // Vigente si hoy está entre "desde" y "hasta" (las dos incluidas).
  // Sin "desde": no se publica. Sin "hasta": no termina.

  function imagenesVigentes() {
    const hoy = fechaDeHoy();
    return (Array.isArray(ajustes.imagenes) ? ajustes.imagenes : [])
      .filter(dato => dato && String(dato.imagen || "").trim())
      .filter(dato => {
        const desde = textoFechaOferta(dato.desde);
        const hasta = textoFechaOferta(dato.hasta);
        if (desde === "invalida" || hasta === "invalida") {
          console.warn(`Carrusel: la imagen "${dato.imagen}" tiene una fecha mal escrita (usá 2026-11-12 o 12/11/2026).`);
          return false;
        }
        return Boolean(desde) && desde <= hoy && (!hasta || hoy <= hasta);
      })
      .map(dato => {
        const archivo = String(dato.imagen).trim();
        return {
          tipo: "imagen",
          src: archivo.includes("/") ? archivo : carpetaImagenes + archivo,
          texto: String(dato.titulo || "").trim(),
          buscar: String(dato.buscar || "").trim()
        };
      })
      .filter(item => !imagenesQueFallaron.has(item.src));
  }

  function crearCaraImagen(item, indice) {
    const cara = elemento("div", "ofertaCara ofertaCaraImagen");
    cara.dataset.indice = String(indice);
    const foto = elemento("img", "ofertaImagen");
    foto.src = item.src;
    foto.alt = item.texto;
    foto.decoding = "async";
    foto.draggable = false;
    foto.onerror = () => {
      // Imagen que no está en la carpeta: se saca del carrusel
      foto.onerror = null;
      console.warn(`Carrusel: no se encontró la imagen ${item.src}`);
      imagenesQueFallaron.add(item.src);
      construir();
    };
    const accionPropia = elemento("div", "ofertaCaraAccion");
    cara.append(foto, accionPropia);
    return cara;
  }

  // "Ver productos": busca el texto de la imagen en el catálogo
  function crearControlImagen(item) {
    const caja = elemento("div", "ofertaControl");
    if (!item.buscar) return caja;
    const boton = elemento("button", "ofertaAgregar ofertaVerProductos", "Ver productos");
    boton.type = "button";
    boton.onclick = evento => {
      evento.stopPropagation();
      searchInput.value = item.buscar;
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    };
    caja.appendChild(boton);
    return caja;
  }


  /* ---------------- TARJETAS ---------------- */

  function crearCara(item, indice) {
    if (item.tipo === "imagen") return crearCaraImagen(item, indice);
    const cara = elemento("div", "ofertaCara");
    cara.dataset.indice = String(indice);
    if (item.agotado) cara.classList.add("agotada");

    const tarjeta = elemento("div", "ofertaTarjeta");

    const marcoFoto = elemento("div", "ofertaCaraMarco");
    const foto = elemento("img", "ofertaCaraFoto");
    foto.src = item.product.image || categoryImage(item.product.category);
    foto.alt = "";
    foto.decoding = "async";
    foto.draggable = false;
    foto.onerror = () => {
      foto.onerror = null;
      foto.src = categoryImage(item.product.category);
    };
    marcoFoto.append(foto, elemento("span", "ofertaGlobo ofertaCaraGlobo", `-${item.oferta.ahorro}%`));

    const nombre = elemento("span", "ofertaCaraNombre", item.product.name);

    const precios = elemento("span", "ofertaCaraPrecios");
    precios.append(
      elemento("strong", "ofertaCaraPrecio", formatter.format(item.oferta.precio)),
      elemento("s", "ofertaTachado", formatter.format(item.oferta.antes))
    );

    tarjeta.append(marcoFoto, nombre, precios);
    if (item.agotado) {
      const franja = elemento("div", "ofertaAgotadaFranja");
      franja.appendChild(elemento("span", "", "AGOTADO!"));
      tarjeta.appendChild(franja);
    }

    // En la fila plana, cada tarjeta lleva su botón debajo
    const accionPropia = elemento("div", "ofertaCaraAccion");
    cara.append(tarjeta, accionPropia);
    return cara;
  }

  function construir() {
    items = carruselVisible ? armarItems() : [];
    anillo.replaceChildren();
    caras = items.map(crearCara);
    caras.forEach(cara => anillo.appendChild(cara));

    // Solo imágenes (sin ofertas hoy): otro título y sin cuenta regresiva
    const hayOfertas = items.some(item => item.tipo !== "imagen");
    nombreTitulo.textContent = hayOfertas
      ? (ajustes.titulo || "🔥 Ofertas de hoy")
      : (ajustes.tituloSinOfertas || "📣 Novedades");
    termina.hidden = !hayOfertas;
    seccion.setAttribute("aria-label", nombreTitulo.textContent.replace(/^\W+/, ""));

    modoPlano = !con3D || sinMovimiento.matches ||
      items.length < MINIMO_ANILLO || items.length > MAXIMO_ANILLO;
    seccion.classList.toggle("modoPlano", modoPlano);
    pista.hidden = modoPlano;

    frente = -1;
    angulo = 0;
    estado = "girando";
    cerrarVariedades();
    medir();
    refrescarAcciones();
    actualizarVisible();
  }


  /* ---------------- BOTÓN AGREGAR ---------------- */
  // Carga la oferta al pedido sin salir del carrusel (con su step).

  function despuesDeCambiar(product) {
    saveCart();
    productGrid.querySelectorAll(`.productCard:not(.posterCard)[data-product-id="${CSS.escape(idProducto(product))}"]`)
      .forEach(tarjeta => {
        updateCardControls(tarjeta, product, true);
        actualizarFormasDeCompra(tarjeta, product, false);
      });
    updateWhatsAppLink();
    updateCheckoutUI();
  }

  function latir(nodo) {
    nodo.classList.remove("latido");
    void nodo.offsetWidth;
    nodo.classList.add("latido");
  }

  // "Agregar (x2)" o, si ya está en el pedido, − cantidad +
  function crearControl(product, agotado) {
    const caja = elemento("div", "ofertaControl");
    const id = idProducto(product);

    if (agotado || !product.inStock) {
      const boton = elemento("button", "ofertaAgregar", "Agotado");
      boton.type = "button";
      boton.disabled = true;
      caja.appendChild(boton);
      return caja;
    }

    if (!cart[id]) {
      const forma = formaDeCompra(product, 1);
      const texto = forma.unidadesPorPaso > 1 && !formaConMedida(forma)
        ? `Agregar x${forma.unidadesPorPaso}`
        : (formaConMedida(forma) ? `Agregar ${forma.medida}` : "Agregar");
      const boton = elemento("button", "ofertaAgregar", texto);
      boton.type = "button";
      boton.setAttribute("aria-label", `${texto}: ${product.name}`);
      boton.onclick = evento => {
        evento.stopPropagation();
        agregarAlCarrito(product, 1);
        despuesDeCambiar(product);
        mantenerQuieto();
      };
      caja.appendChild(boton);
      return caja;
    }

    const menos = elemento("button", "ofertaMenos", "−");
    menos.type = "button";
    menos.setAttribute("aria-label", `Quitar de ${product.name}`);
    menos.onclick = evento => {
      evento.stopPropagation();
      cambiarCantidadEnCarrito(product, -1);
      despuesDeCambiar(product);
      mantenerQuieto();
    };
    const cantidad = elemento("span", "ofertaCantidad", textoCantidad(formaEnCarrito(product), cart[id]));
    const mas = elemento("button", "ofertaMas", "+");
    mas.type = "button";
    mas.setAttribute("aria-label", `Sumar ${product.name}`);
    mas.onclick = evento => {
      evento.stopPropagation();
      cambiarCantidadEnCarrito(product, +1);
      despuesDeCambiar(product);
      mantenerQuieto();
    };
    caja.classList.add("enPedido");
    caja.append(menos, cantidad, mas);
    return caja;
  }

  // Botón de un grupo: abre sus variedades acá mismo
  function crearControlGrupo(item, indice) {
    const caja = elemento("div", "ofertaControl");
    const enPedido = item.variedades.reduce((total, product) => total + (cart[idProducto(product)] ? 1 : 0), 0);
    const boton = elemento("button", "ofertaAgregar ofertaElegir",
      item.agotado ? "Agotado" : (variedadesAbiertas === indice ? "Cerrar variedades" : "Elegir variedad"));
    boton.type = "button";
    boton.disabled = item.agotado;
    if (enPedido) boton.appendChild(elemento("span", "ofertaEnPedido", String(enPedido)));
    boton.onclick = evento => {
      evento.stopPropagation();
      if (variedadesAbiertas === indice) cerrarVariedades();
      else abrirVariedadesEnCarrusel(indice);
      refrescarAcciones();
    };
    caja.appendChild(boton);
    return caja;
  }

  function controlDe(indice) {
    const item = items[indice];
    if (item.tipo === "imagen") return crearControlImagen(item);
    return item.tipo === "poster" ? crearControlGrupo(item, indice) : crearControl(item.product, item.agotado);
  }

  // Variedades del grupo, debajo del anillo
  function abrirVariedadesEnCarrusel(indice) {
    variedadesAbiertas = indice;
    clearTimeout(esperaGiro);   // mientras elige, no gira
    dibujarVariedades();
    panel.hidden = false;
  }

  function cerrarVariedades() {
    if (variedadesAbiertas === -1) return;
    variedadesAbiertas = -1;
    panel.hidden = true;
    panel.replaceChildren();
    if (estado === "quieto") quedarQuieto();
  }

  function dibujarVariedades() {
    const item = items[variedadesAbiertas];
    if (!item) return;
    panel.replaceChildren();
    const encabezado = elemento("div", "ofertasVariedadesTitulo");
    encabezado.appendChild(elemento("span", "", "Elegí la variedad"));
    const cerrar = elemento("button", "ofertasVariedadesCerrar", "×");
    cerrar.type = "button";
    cerrar.setAttribute("aria-label", "Cerrar variedades");
    cerrar.onclick = () => {
      cerrarVariedades();
      refrescarAcciones();
    };
    encabezado.appendChild(cerrar);
    panel.appendChild(encabezado);

    item.variedades.forEach(product => {
      const fila = elemento("div", "ofertasVariedad");
      const foto = elemento("img", "ofertasVariedadFoto");
      foto.src = product.image || categoryImage(product.category);
      foto.alt = "";
      foto.loading = "lazy";
      foto.onerror = () => {
        foto.onerror = null;
        foto.src = categoryImage(product.category);
      };
      fila.append(foto, elemento("span", "ofertasVariedadNombre", product.name), crearControl(product, false));
      panel.appendChild(fila);
    });
  }

  // Vuelve a dibujar los botones (después de cualquier cambio en el pedido)
  function refrescarAcciones() {
    if (modoPlano) {
      accion.replaceChildren();
      caras.forEach((cara, indice) => {
        cara.querySelector(".ofertaCaraAccion").replaceChildren(controlDe(indice));
      });
    } else {
      const control = frente >= 0 ? controlDe(frente) : null;
      const conBoton = Boolean(control && control.childElementCount);
      accion.replaceChildren(conBoton ? control : "");
      accion.classList.toggle("visible", conBoton);
    }
    if (variedadesAbiertas >= 0) dibujarVariedades();
  }

  // Mientras toca los botones, el anillo no vuelve a girar
  function mantenerQuieto() {
    if (!modoPlano && estado === "quieto") quedarQuieto();
  }

  // El pedido cambió en otro lado (tarjeta, hoja "Tu pedido")
  document.addEventListener("carritocambio", () => {
    if (!seccion.hidden) refrescarAcciones();
  });


  /* ---------------- MEDIDAS DEL ANILLO ---------------- */
  // Cada cara: rotateY(n × 360°/caras) translateZ(radio)

  // Las imágenes (verticales, 9:16) tienen el mismo alto que las tarjetas
  // de oferta; el ancho sale de la proporción.
  function medirImagenes(anchoCara) {
    const tarjeta = anillo.querySelector(".ofertaCara:not(.ofertaCaraImagen) .ofertaTarjeta");
    const altoTarjeta = (tarjeta && tarjeta.offsetHeight) || anchoCara + 74;
    const alto = modoPlano && !tarjeta ? Math.round(anchoCara * 1.6) : altoTarjeta;
    const anchoImagen = Math.round(alto * PROPORCION_IMAGEN);
    caras.forEach((cara, indice) => {
      if (items[indice].tipo !== "imagen") return;
      cara.style.width = `${anchoImagen}px`;
      cara.style.flexBasis = `${anchoImagen}px`;
      cara.style.left = modoPlano ? "" : `${(anchoCara - anchoImagen) / 2}px`;
    });
    return anchoImagen;
  }

  function medir() {
    const ancho = escena.clientWidth || seccion.clientWidth || 360;
    const anchoCara = Math.round(Math.max(128, Math.min(200, ancho * 0.38)));
    seccion.style.setProperty("--ancho-cara", `${anchoCara}px`);
    const anchoImagen = medirImagenes(anchoCara);

    if (modoPlano || caras.length === 0) {
      caras.forEach(cara => { cara.style.transform = ""; cara.style.opacity = ""; cara.style.filter = ""; });
      anillo.style.transform = "";
      return;
    }

    // Cada cara ocupa un ángulo según su ancho. Se busca el radio con el
    // que todas juntas dan la vuelta completa (360°).
    const mitades = items.map(item => (item.tipo === "imagen" ? anchoImagen : anchoCara) / 2 + SEPARACION / 2);
    const vuelta = r => mitades.reduce((total, mitad) => total + 2 * Math.atan(mitad / r), 0);
    let menor = 1;
    let mayor = 20000;
    for (let vez = 0; vez < 60; vez++) {
      const medio = (menor + mayor) / 2;
      if (vuelta(medio) > 2 * Math.PI) menor = medio;
      else mayor = medio;
    }
    radio = Math.round(mayor);

    angulos = [];
    let acumulado = 0;
    mitades.forEach((mitad, indice) => {
      const medioAngulo = Math.atan(mitad / radio) * 180 / Math.PI;
      if (indice > 0) acumulado += medioAngulo;
      angulos.push(acumulado);
      acumulado += medioAngulo;
    });
    paso = 360 / caras.length;
    caras.forEach((cara, indice) => {
      cara.style.transform = `rotateY(${angulos[indice]}deg) translateZ(${radio}px)`;
    });
    dibujar();
  }

  // Ángulo de una cara respecto del frente (-180 a 180)
  function relativo(indice) {
    let diferencia = ((angulos[indice] ?? indice * paso) - angulo) % 360;
    if (diferencia > 180) diferencia -= 360;
    if (diferencia < -180) diferencia += 360;
    return diferencia;
  }

  function caraAlFrente() {
    let mejor = 0;
    caras.forEach((_, indice) => {
      if (Math.abs(relativo(indice)) < Math.abs(relativo(mejor))) mejor = indice;
    });
    return mejor;
  }

  // La del frente nítida, las de atrás más apagadas
  function dibujar() {
    if (modoPlano) return;
    anillo.style.transform = `translateZ(${-radio}px) rotateY(${-angulo}deg)`;
    caras.forEach((cara, indice) => {
      const lejos = Math.min(1, Math.abs(relativo(indice)) / 180);
      cara.style.opacity = String(1 - lejos * 0.6);
      cara.style.filter = lejos < 0.05 ? "" : `brightness(${1 - lejos * 0.35}) saturate(${1 - lejos * 0.4})`;
    });
    const nuevoFrente = estado === "quieto" ? caraAlFrente() : -1;
    if (nuevoFrente !== frente) {
      caras.forEach((cara, indice) => cara.classList.toggle("alFrente", indice === nuevoFrente));
      frente = nuevoFrente;
      if (variedadesAbiertas !== -1 && variedadesAbiertas !== frente) cerrarVariedades();
      refrescarAcciones();
    }
  }


  /* ---------------- MOVIMIENTO ---------------- */

  function animar(tiempo) {
    cuadro = 0;
    const segundos = ultimoCuadro ? Math.min(0.05, (tiempo - ultimoCuadro) / 1000) : 0;
    ultimoCuadro = tiempo;

    if (estado === "girando") {
      angulo += (paso / SEGUNDOS_POR_CARA) * segundos;
    } else if (estado === "inercia") {
      angulo += velocidad * segundos;
      velocidad *= Math.pow(0.04, segundos);   // frena rápido
      if (Math.abs(velocidad) < paso * 0.8) llevarA(angulo + relativo(caraAlFrente()));
    } else if (estado === "llevando") {
      const falta = destino - angulo;
      angulo += falta * Math.min(1, segundos * 9);
      if (Math.abs(falta) < 0.15) {
        angulo = destino;
        quedarQuieto();
      }
    }

    dibujar();
    if (seMueve()) pedirCuadro();
  }

  function seMueve() {
    return ["girando", "inercia", "llevando"].includes(estado);
  }

  function puedeAnimar() {
    return !modoPlano && enPantalla && !seccion.hidden && document.visibilityState === "visible";
  }

  function pedirCuadro() {
    if (cuadro || !puedeAnimar()) return;
    cuadro = requestAnimationFrame(animar);
  }

  function frenarCuadros() {
    if (cuadro) cancelAnimationFrame(cuadro);
    cuadro = 0;
    ultimoCuadro = 0;
  }

  function llevarA(nuevoAngulo) {
    clearTimeout(esperaGiro);
    destino = nuevoAngulo;
    estado = "llevando";
    pedirCuadro();
  }

  // Lleva la cara al frente por el camino más corto
  function traerAlFrente(indice) {
    llevarA(angulo + relativo(indice));
  }

  function quedarQuieto() {
    estado = "quieto";
    velocidad = 0;
    dibujar();
    clearTimeout(esperaGiro);
    if (variedadesAbiertas !== -1) return;   // eligiendo variedad: no gira
    esperaGiro = setTimeout(() => {
      if (estado !== "quieto" || variedadesAbiertas !== -1) return;
      estado = "girando";
      dibujar();
      pedirCuadro();
    }, ESPERA_PARA_GIRAR);
  }


  /* ---------------- DEDO Y MOUSE ---------------- */

  let toque = null;

  escena.addEventListener("pointerdown", evento => {
    if (modoPlano || evento.button > 0) return;
    toque = {
      id: evento.pointerId,
      x: evento.clientX,
      anguloInicial: angulo,
      estadoInicial: estado,
      arrastre: false,
      ultimoX: evento.clientX,
      ultimoTiempo: performance.now(),
      velocidad: 0
    };
  });

  escena.addEventListener("pointermove", evento => {
    if (!toque || evento.pointerId !== toque.id) return;
    const distancia = evento.clientX - toque.x;
    if (!toque.arrastre && Math.abs(distancia) > ARRASTRE_MINIMO) {
      toque.arrastre = true;
      clearTimeout(esperaGiro);
      estado = "arrastrando";
      frenarCuadros();
      dibujar();
      try { escena.setPointerCapture(evento.pointerId); } catch (error) { /* sin captura */ }
    }
    if (!toque.arrastre) return;

    // El anillo sigue al dedo (un px de arrastre = un px del borde del anillo)
    const gradosPorPixel = 180 / Math.PI / Math.max(1, radio);
    angulo = toque.anguloInicial - distancia * gradosPorPixel;

    const ahora = performance.now();
    const tiempo = Math.max(1, ahora - toque.ultimoTiempo);
    toque.velocidad = -((evento.clientX - toque.ultimoX) * gradosPorPixel) / (tiempo / 1000);
    toque.ultimoX = evento.clientX;
    toque.ultimoTiempo = ahora;
    dibujar();
  });

  function soltar(evento) {
    if (!toque || evento.pointerId !== toque.id) return;
    const anterior = toque;
    toque = null;

    if (anterior.arrastre) {
      // Sigue un poco por inercia y se acomoda en la cara más cercana
      velocidad = Math.max(-720, Math.min(720, anterior.velocidad));
      estado = "inercia";
      pedirCuadro();
      return;
    }
    if (evento.type === "pointercancel") return;

    const cara = evento.target.closest(".ofertaCara");
    if (!cara) return;
    const indice = Number(cara.dataset.indice);

    if (anterior.estadoInicial !== "quieto" || indice !== caraAlFrente()) {
      // Girando: lo frena. Quieto: la de costado viene al frente.
      traerAlFrente(indice);
    } else {
      quedarQuieto();   // tocó la del frente: espera otros 4 segundos
    }
  }
  escena.addEventListener("pointerup", soltar);
  escena.addEventListener("pointercancel", soltar);

  // Flechas del teclado: cara anterior / siguiente
  seccion.addEventListener("keydown", evento => {
    if (modoPlano || !["ArrowLeft", "ArrowRight"].includes(evento.key)) return;
    if (evento.target.closest(".ofertasVariedades")) return;
    evento.preventDefault();
    const actual = caraAlFrente();
    const siguiente = (actual + (evento.key === "ArrowRight" ? 1 : -1) + caras.length) % caras.length;
    traerAlFrente(siguiente);
  });


  /* ---------------- CUÁNDO SE VE ---------------- */
  // Solo con la lista completa (sin buscar ni filtrar) y si hay ofertas.

  function actualizarVisible() {
    const visible = items.length > 0 && modoListaCompleta;
    const estabaOculto = seccion.hidden;
    seccion.hidden = !visible;
    if (visible && estabaOculto) {
      medir();
      refrescarAcciones();
    }
    if (visible) pedirCuadro();
    else frenarCuadros();
  }
  window.actualizarCarruselOfertas = actualizarVisible;

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entradas => {
      enPantalla = entradas[0].isIntersecting;
      if (enPantalla) pedirCuadro();
      else frenarCuadros();
    }).observe(seccion);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pedirCuadro();
    else frenarCuadros();
  });

  let anchoAnterior = 0;
  window.addEventListener("resize", () => {
    const ancho = seccion.clientWidth;
    if (ancho === anchoAnterior) return;
    anchoAnterior = ancho;
    medir();
  });

  const cambioMovimiento = () => construir();
  if (sinMovimiento.addEventListener) sinMovimiento.addEventListener("change", cambioMovimiento);

  // A la medianoche se vuelve a armar (js/ofertas.js)
  document.addEventListener("ofertascambiaron", construir);


  /* ---------------- CUENTA REGRESIVA ---------------- */

  function actualizarReloj() {
    const total = Math.max(0, Math.floor(msHastaMedianoche() / 1000));
    const horas = String(Math.floor(total / 3600)).padStart(2, "0");
    const minutos = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const segundos = String(total % 60).padStart(2, "0");
    reloj.textContent = `${horas}:${minutos}:${segundos}`;
  }
  actualizarReloj();
  setInterval(() => {
    if (!seccion.hidden) actualizarReloj();
  }, 1000);

  construir();

})();
