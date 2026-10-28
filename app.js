/* =========================================================
   APP.JS
   ---------------------------------------------------------
   Punto de entrada principal de la PWA.
   ========================================================= */

/* La configuración de la empresa (nombre, logo, colores, etc.)
   se aplica desde js/cliente.js con los datos de cliente/config.js */

    /* =====================================================
       HACEMOS EL HEADER COMPACTOR AL SCROLEAR
       ===================================================== */

       const toolbar =
       document.querySelector(".toolbar");
   
   
   window.addEventListener("scroll", () => {
   
       if(window.scrollY > 40){
   
           toolbar.classList.add("compact");
   
       }else{
   
           toolbar.classList.remove("compact");
   
       }
   
   });

const formatter = new Intl.NumberFormat(CLIENTE.empresa.idioma, {
  style: "currency",
  currency: CLIENTE.empresa.moneda,
  maximumFractionDigits: 0
});

// Estado inicial limpio de filtros cruzados
// (los filtros se definen en cliente/config.js)
let activeFilters = filtrosVacios();

// Estado global del carrito de compras (Id del producto: cantidad)
// Se usa el Id porque nunca cambia, aunque se agreguen o quiten
// productos en products-data.js.
const cart = {};

// Nombre con el que se guarda el carrito en el celular
const CART_STORAGE_KEY = "carrito";

// Búsqueda rápida de un producto por su Id
const productosPorId = new Map(
  products.map(product => [String(product.Id), product])
);

// Posición de cada producto en el catálogo (solo para ordenar el pedido)
const posicionEnCatalogo = new Map(
  products.map((product, posicion) => [String(product.Id), posicion])
);

function idProducto(product) {
  return String(product.Id);
}

function productoPorId(id) {
  return productosPorId.get(String(id));
}

// Cambios detectados al abrir la app (sin stock, precios nuevos, etc.)
let cambiosCarrito = [];

// Variedades de cada poster (Id del poster → productos) y posters abiertos
let variedadesPorPoster = new Map();
const postersAbiertos = new Set();

// true cuando se ve la lista completa (sin buscar ni filtrar):
// solo ahí van las barras de categoría y se tapan los huecos
let modoListaCompleta = false;

// Chips marcados debajo del buscador (se combinan). Ver js/chips.js
let chipsActivos = [];

// Cuántos íconos de chips entran arriba a la derecha de la tarjeta
const MAXIMO_ICONOS_TARJETA = 2;

// Mensajes institucionales que tapan los huecos (ver crearInstitucional)
const INSTITUCIONAL = (CLIENTE.institucional?.mensajes || [])
  .filter(mensaje => mensaje && (mensaje.imagen || mensaje.titulo || mensaje.texto));
const CARPETA_INSTITUCIONAL = CLIENTE.institucional?.carpeta || "";
// {compraMinima} y {alias} se completan solos en los textos
const VARIABLES_INSTITUCIONAL = {
  compraMinima: formatter.format(Number(CLIENTE.pedido?.compraMinima) || 0),
  alias: CLIENTE.pedido?.alias || ""
};

// Huecos que ya se animaron (por la categoría que sigue): no se repite la entrada
const institucionalesVistos = new Set();

const observadorInstitucional = new IntersectionObserver(entradas => {
  entradas.forEach(entrada => {
    if (!entrada.isIntersecting) return;
    const tarjeta = entrada.target;
    tarjeta.classList.add("institucionalEntrando");
    institucionalesVistos.add(tarjeta.dataset.clave);
    observadorInstitucional.unobserve(tarjeta);
  });
}, { threshold: 0.25 });

// ---------------------------------------------------------
// FORMAS DE COMPRA EN EL CARRITO (ver js/formas-compra.js)
// "cart" guarda siempre UNIDADES INDIVIDUALES por producto.
// "cartOpcion" guarda con qué forma se compra (solo si es la 2).
// ---------------------------------------------------------

const cartOpcion = {};

// Forma elegida en la tarjeta antes de agregar el producto
const opcionEnTarjeta = {};

function formaEnCarrito(product) {
  return formaDeCompra(product, cartOpcion[idProducto(product)] || 1);
}

// La tarjeta muestra la forma del carrito o, si no está, la elegida
function formaEnTarjeta(product) {
  const id = idProducto(product);
  if (cart[id]) return formaEnCarrito(product);
  return formaDeCompra(product, opcionEnTarjeta[id] || 1);
}

function precioUnitarioEnCarrito(product) {
  return formaEnCarrito(product).precioUnitario;
}

function guardarFormaEnCarrito(id, forma) {
  if (forma.numero === 1) {
    delete cartOpcion[id];
  } else {
    cartOpcion[id] = forma.numero;
  }
}

function agregarAlCarrito(product, numeroForma) {
  const id = idProducto(product);
  const forma = formaDeCompra(product, numeroForma);
  cart[id] = unidadesMinimas(forma);
  guardarFormaEnCarrito(id, forma);
  opcionEnTarjeta[id] = forma.numero;
}

function cambiarCantidadEnCarrito(product, sentido) {
  const id = idProducto(product);
  if (!cart[id]) return;
  const forma = formaEnCarrito(product);
  cart[id] += sentido * forma.unidadesPorPaso;

  const formas = formasDeCompra(product);

  if (formas.length === 2) {
    const [forma1, forma2] = formas;

    // Comprando por unidad, al llegar a la cantidad de la forma 2
    // (ej. 12 unidades = 1 caja) pasa sola a la forma 2.
    if (forma.numero === 1 && cart[id] >= unidadesMinimas(forma2)) {
      cart[id] = unidadesMinimas(forma2);
      guardarFormaEnCarrito(id, forma2);
      opcionEnTarjeta[id] = 2;
      return;
    }

    // Precio escalonado (ej. "5 bultos o más"): al bajar del mínimo
    // sigue en bultos, pero al precio normal.
    if (
      forma2.mismaMedida &&
      forma.numero === 2 &&
      cart[id] < unidadesMinimas(forma2) &&
      cart[id] >= unidadesMinimas(forma1)
    ) {
      guardarFormaEnCarrito(id, forma1);
      opcionEnTarjeta[id] = 1;
      return;
    }
  }

  if (cart[id] < unidadesMinimas(forma)) {
    quitarDelCarrito(id);
  }
}

function quitarDelCarrito(id) {
  delete cart[id];
  delete cartOpcion[id];
}

// Cambia de forma un producto que ya está en el carrito.
// - A la forma 2: queda en el mínimo de la forma 2 (ej. 1 caja).
// - A la forma 1 (después de confirmar): queda en el mínimo de la forma 1
//   (ej. 1 unidad). Nunca se cobran 11 unidades sueltas en vez de 1 caja.
function cambiarFormaEnCarrito(product, numeroForma) {
  const id = idProducto(product);
  const forma = formaDeCompra(product, numeroForma);
  opcionEnTarjeta[id] = forma.numero;
  if (!cart[id]) return;
  cart[id] = unidadesMinimas(forma);
  guardarFormaEnCarrito(id, forma);
}

// Variable global interna para guardar la URL de WhatsApp calculada en tiempo real
let globalWhatsAppUrl = "";
// El mismo pedido como texto (ticket armado), para copiarlo
let textoPedidoArmado = "";

/* ---------------- PALABRAS RESERVADAS ----------------
   Escritas en el buscador activan funciones para el vendedor
   (cliente/config.js → palabrasReservadas). Valen hasta cerrar la app.
   - quiebre: muestra solo los productos sin stock
   - enviarIgual (send): pedido sin mínimo, se copia y se elige el contacto (js/carrito.js)
   - desbloquear (unlock): todos los productos sin stock pasan a disponibles */

function palabraReservada(nombre) {
  const palabras = CLIENTE.palabrasReservadas || {};
  // Compatibilidad con el config viejo (pedido.palabraEnviarIgual)
  const valor = nombre === "enviarIgual" && palabras.enviarIgual === undefined
    ? CLIENTE.pedido?.palabraEnviarIgual
    : palabras[nombre];
  return normalize(String(valor || "").trim());
}

function esPalabraReservada(texto, nombre) {
  const palabra = palabraReservada(nombre);
  return Boolean(palabra) && normalize(String(texto || "").trim()) === palabra;
}

// Productos que estaban sin stock y se habilitaron con "unlock"
let productosDesbloqueados = false;

function desbloquearSinStock() {
  if (productosDesbloqueados) return 0;
  productosDesbloqueados = true;
  let cantidad = 0;
  products.forEach(product => {
    if (esProducto(product) && !product.inStock) {
      product.inStock = true;
      product.estabaSinStock = true;
      cantidad++;
    }
  });
  return cantidad;
}

// Observador para la animación suave al hacer scroll (.animate-in)
const scrollObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animate-in');
      scrollObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

// Elementos capturados del DOM Principal
const productGrid = document.querySelector("#productGrid");
const emptyState = document.querySelector("#emptyState");
const resultCount = document.querySelector("#resultCount");
const activeQuery = document.querySelector("#activeQuery");
const searchInput = document.querySelector("#searchInput");
const template = document.querySelector("#productTemplate");
const whatsappElement = document.querySelector(".whatsappBtn");

// Elementos del Modal Lateral
const filterToggleBtn = document.querySelector("#filterToggleBtn");
const filterModal = document.querySelector("#filterModal");
const closeFilterBtn = document.querySelector("#closeFilterBtn");
const clearFiltersBtn = document.querySelector("#clearFiltersBtn");

// Generador de imágenes vectoriales SVG por categoría (Fallback)
function categoryImage(category) {
  // Colores por categoría definidos en cliente/config.js
  const categoryStyles = CLIENTE.imagenRespaldo || {};
  const [label, color, background] = categoryStyles[category] || ["Producto", "#334155", "#e2e8f0"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="${background}"/><rect x="130" y="72" width="380" height="276" rx="28" fill="#fff" opacity=".92"/><rect x="170" y="118" width="300" height="178" rx="22" fill="${color}"/><circle cx="218" cy="164" r="34" fill="#fff" opacity=".22"/><path d="M170 258c66-38 115-36 169 0s87 39 131 4v34H170z" fill="#fff" opacity=".18"/><text x="320" y="205" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="800" fill="#fff">${category}</text><text x="320" y="244" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#fff" opacity=".9">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// Normalización de texto para búsquedas libres
function normalize(value) {
  if (!value) return "";
  return value.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function productMatches(product, query) {
  const searchableText = `${product.brand || ''} ${product.category || ''} ${product.name || ''} ${product.keywords || ''}`;
  return normalize(searchableText).includes(query);
}

// Borrado completo del texto buscado
searchInput.addEventListener("click", function (event) {
  if (event.target === voiceSearchBtn) return;

  if (this.value !== "") {
    this.value = "";

    this.dispatchEvent(
      new Event("input", {
        bubbles: true
      })
    );
  }
});

// Esconder el circulo gris de la "X" de borrar texto.
function updateClearVisual() {
  if (searchInput.value.trim() !== "") {
    searchInput.closest(".searchBox").classList.add("has-search");
  } else {
    searchInput.closest(".searchBox").classList.remove("has-search");
  }
}

searchInput.addEventListener("input", updateClearVisual);

updateClearVisual();

// Redondeo a billetes de $100
function roundToHundreds(value) {
  return Math.round(value / 100) * 100;
}

function updateFilterOptions(allowAutoSelect = true) {
  if (typeof products === "undefined" || !products) return;

  const pools = {};
  FILTROS.forEach(filtro => { pools[filtro.campo] = new Set(); });

  const valid = (val) => val && val.toString().trim().toUpperCase() !== "NO" && val.toString().trim() !== "";

  productosVendibles.forEach(product => {
    FILTROS.forEach(filtro => {
      const campo = filtro.campo;

      // El producto debe cumplir todos los OTROS filtros activos
      const cumpleOtros = FILTROS.every(otro =>
        otro.campo === campo ||
        activeFilters[otro.campo] === "ALL" ||
        product[otro.campo] === activeFilters[otro.campo]
      );

      if (cumpleOtros && valid(product[campo])) pools[campo].add(product[campo].toString().trim());
    });
  });

  Object.keys(pools).forEach(key => {
    const groupElement = document.querySelector(`.filterGroup[data-filter="${key}"]`);
    if (!groupElement) return;

    const triggerBtn = groupElement.querySelector(".customSelectTrigger");
    const dropdown = groupElement.querySelector(".optionsDropdown");
    const optionsArray = Array.from(pools[key]).sort();

    const userIsFilteringModal = Object.values(activeFilters).some(v => v !== "ALL");

    if (allowAutoSelect && userIsFilteringModal && optionsArray.length === 1 && activeFilters[key] === "ALL") {
      activeFilters[key] = optionsArray[0];
      triggerBtn.disabled = true;
      dropdown.hidden = true;
      triggerBtn.classList.remove("is-active");
    } 
    else if (optionsArray.length === 0 && activeFilters[key] === "ALL") {
      triggerBtn.disabled = true;
      dropdown.hidden = true;
      triggerBtn.classList.remove("is-active");
    } 
    else {
      triggerBtn.disabled = false;
    }

    const filtro = FILTROS.find(f => f.campo === key);
    triggerBtn.textContent = activeFilters[key] === "ALL" ? filtro.titulo : activeFilters[key];

    // INTEGRACIÓN ESTÉTICA: Agrega la tilde visual parpadeante si el filtro no está en ALL
    triggerBtn.classList.toggle("has-filter", activeFilters[key] !== "ALL");

    dropdown.replaceChildren();

    if (activeFilters[key] !== "ALL") {
      const clearBtn = document.createElement("button");
      clearBtn.className = "optionsItem clear-option";
      clearBtn.type = "button";
      clearBtn.textContent = "✕ Quitar filtro";
      clearBtn.onclick = (e) => {
        e.stopPropagation();
        activeFilters[key] = "ALL";
        triggerBtn.disabled = false;
        updateFilterOptions(false); 
        handleFilterPipeline();
        irArriba();
      };
      dropdown.appendChild(clearBtn);
    }

    optionsArray.forEach(opt => {
      const optBtn = document.createElement("button");
      optBtn.className = "optionsItem";
      optBtn.type = "button";
      optBtn.textContent = opt;

      if (activeFilters[key] === opt) {
        optBtn.classList.add("is-selected");
      }

      optBtn.onclick = (e) => {
        e.stopPropagation();
        activeFilters[key] = opt;
        dropdown.hidden = true;
        triggerBtn.classList.remove("is-active");
        updateFilterOptions(true); 
        handleFilterPipeline();
        irArriba();
      };

      dropdown.appendChild(optBtn);
    });
  });
}

loadCart();
handleFilterPipeline();
updateWhatsAppLink();
updateCheckoutUI();

function handleFilterPipeline() {
  if (typeof products === "undefined" || !products) return;

  const queryOriginal = searchInput.value;
  const query = normalize(
    typeof applySearchRules === "function"
      ? applySearchRules(queryOriginal)
      : queryOriginal
  );

  const adminMode = esPalabraReservada(query, "quiebre");

   // =====================================================
  // BÚSQUEDA INTELIGENTE
  // =====================================================

  let smartResultIds = null;
let smartResultGroups = null;
let fullMatchIds = new Set();

  if (!adminMode && query) {

    const queryTerms =
      query
        .split(/\s+/)
        .map(term => term.trim())
        .filter(Boolean);

    // -----------------------------------------------------
    // UNA SOLA PALABRA
    // -----------------------------------------------------

    if (queryTerms.length === 1) {

      if (
        typeof window.searchIndex !== "undefined" &&
        typeof getSearchCandidates === "function" &&
        typeof rankSearchCandidates === "function"
      ) {

        const candidates =
          getSearchCandidates(
            query,
            window.searchIndex
          );

        const ranked =
          rankSearchCandidates(candidates);

        smartResultIds =
          new Set(
            ranked.map(result =>
              String(result.productId)
            )
          );

      } else {

        smartResultIds =
          new Set(
            products
              .filter(product =>
                productMatches(
                  product,
                  query
                )
              )
              .map(product =>
                String(product.Id)
              )
          );

      }

    }

    // -----------------------------------------------------
    // DOS O MÁS PALABRAS
    // -----------------------------------------------------

    else {

      let matchingIds = null;

      queryTerms.forEach(term => {

        const termIds = new Set();

        window.searchIndex.forEach(entry => {

          if (
            !entry ||
            !entry.product ||
            !entry.tokens
          ) {
            return;
          }

          const matchesTerm =
            entry.tokens.some(token => {

              const normalizedToken =
                normalizeSearchValue(token);

              if (!normalizedToken) {
                return false;
              }

              return (
                normalizedToken.startsWith(term) ||
                normalizedToken.includes(term)
              );

            });

          if (matchesTerm) {

            termIds.add(
              String(entry.productId)
            );

          }

        });

        if (matchingIds === null) {

          matchingIds =
            new Set(termIds);

        } else {

          matchingIds =
            new Set(
              [...matchingIds].filter(
                productId =>
                  termIds.has(productId)
              )
            );

        }

      });

      smartResultIds =
        matchingIds || new Set();

    }
  }

  // Si la lista de candidatos del buscador encontró algo, las tarjetas
  // muestran exactamente esos productos y en ese mismo orden.
  // (Si no encontró nada, queda la búsqueda aproximada de arriba.)
  let ordenBusqueda = null;

  if (!adminMode && query && typeof calcularCandidatosBusqueda === "function") {
    const candidatos = calcularCandidatosBusqueda(queryOriginal);
    if (candidatos.ids.length) {
      smartResultIds = new Set(candidatos.ids);
      ordenBusqueda = new Map(candidatos.ids.map((id, indice) => [id, indice]));
    }
  }

  // =====================================================
  // FILTRADO
  // =====================================================

  // Con la lista completa se muestran también posters y separadores.
  // Al buscar o filtrar, solo productos.
  const listaCompleta =
    !adminMode &&
    !query &&
    chipsActivos.length === 0 &&
    FILTROS.every(filtro => activeFilters[filtro.campo] === "ALL");

  const filteredProducts = (listaCompleta ? products : productosVendibles).filter(product => {

    const matchesSearch = adminMode
      ? (!product.inStock || product.estabaSinStock)
      : (
          !query ||
          (
            smartResultIds &&
            smartResultIds.has(String(product.Id))
          )
        );

    const matchesFilters = FILTROS.every(filtro =>
      activeFilters[filtro.campo] === "ALL" ||
      product[filtro.campo] === activeFilters[filtro.campo]
    );

    // Chips marcados: se combinan entre sí y con la búsqueda
    const matchesChip = adminMode || productoEnChips(product, chipsActivos);

    return (
      matchesSearch &&
      matchesFilters &&
      matchesChip
    );
  });

  // =====================================================
  // ORDEN DE STOCK
  // =====================================================

if (
    smartResultGroups &&
    smartResultGroups.length > 0
) {

    const groupPosition = new Map();

    smartResultGroups.forEach(
        (group, groupIndex) => {

            group.productIds.forEach(
                productId => {

                    if (!groupPosition.has(productId)) {

                        groupPosition.set(
                            productId,
                            groupIndex
                        );

                    }

                }
            );

        }
    );

    if (
    fullMatchIds &&
    fullMatchIds.size
) {

    const originalOrder =
        new Map(
            products.map(
                (product, index) => [
                    String(product.Id),
                    index
                ]
            )
        );

    filteredProducts.sort(
        (a, b) => {

            const aFull =
                fullMatchIds.has(
                    String(a.Id)
                );

            const bFull =
                fullMatchIds.has(
                    String(b.Id)
                );

            if (aFull !== bFull) {

                return aFull
                    ? -1
                    : 1;

            }

            return (
                originalOrder.get(
                    String(a.Id)
                ) -
                originalOrder.get(
                    String(b.Id)
                )
            );

        }
    );

}

        filteredProducts.sort(
            (a, b) => {

                const groupA =
                    groupPosition.get(
                        String(a.Id)
                    );

                const groupB =
                    groupPosition.get(
                        String(b.Id)
                    );

                if (groupA !== groupB) {

                    return (
                        (groupA ?? Infinity) -
                        (groupB ?? Infinity)
                    );

                }

                return (
                    products.indexOf(a) -
                    products.indexOf(b)
                );

            }
        );

    } else if (ordenBusqueda) {
        // Mismo orden que la lista de candidatos del buscador
        filteredProducts.sort((a, b) =>
            ordenBusqueda.get(String(a.Id)) - ordenBusqueda.get(String(b.Id))
        );
    } else {
        // Sin stock al final de su categoría (con la lista completa,
        // así tampoco se repiten las barras de categoría).
        const ordenada = ordenarSinStockAlFinal(filteredProducts, true);
        filteredProducts.splice(0, filteredProducts.length, ...ordenada);
    }

  // =====================================================
  // INFORMACIÓN SUPERIOR
  // =====================================================

  const cantidadProductos = filteredProducts.filter(esProducto).length;

  // Con la lista completa, las variedades de cada poster se muestran
  // dentro de su desplegable y no se repiten en la lista.
  variedadesPorPoster = new Map();
  if (listaCompleta) {
    const agrupado = agruparVariedades(filteredProducts);
    variedadesPorPoster = agrupado.grupos;
    filteredProducts.splice(0, filteredProducts.length, ...agrupado.lista);
  }

  resultCount.textContent =
    `${cantidadProductos} ${
      cantidadProductos === 1
        ? "producto"
        : "productos"
    }`;

  let label = "Mostrando toda la lista";

  const activeLabels = [];

  chipsActivos.forEach(chip => {
    const emoji = esIconoImagen(chip.icono) ? "" : chip.icono || "";
    activeLabels.push(`${emoji} ${chip.texto}`.trim());
  });

  if (query) {
    activeLabels.push(
      `"${searchInput.value.trim()}"`
    );
  }

  FILTROS.forEach(filtro => {
    if (activeFilters[filtro.campo] !== "ALL") {
      activeLabels.push(activeFilters[filtro.campo]);
    }
  });

  if (adminMode) {

    label =
      "🛠️ Modo administrador: Productos con quiebre de stock";

  } else if (activeLabels.length > 0) {

    label =
      `Filtros activos: ${activeLabels.join(" + ")}`;
  }

  activeQuery.textContent = label;

  // =====================================================
  // RENDER
  // =====================================================

  renderProducts(filteredProducts, query, listaCompleta);
}

updateWhatsAppLink();

// =========================================================
// INTEGRACIÓN DE RESULTADOS DE VOZ
// =========================================================

function showVoiceResults(resultados, textoOriginal) {

  // Sin resultados
  if (!Array.isArray(resultados) || resultados.length === 0) {
    return false;
  }

  // Extraemos los productos y respetamos el orden
  // de relevancia entregado por el motor.
  const productosEncontrados = resultados
    .map(resultado => resultado.product)
    .filter(Boolean);

  if (productosEncontrados.length === 0) {
    return false;
  }

  // Actualizamos la información superior
  resultCount.textContent =
    `${productosEncontrados.length} ${
      productosEncontrados.length === 1
        ? "producto"
        : "productos"
    }`;

  activeQuery.textContent =
    `Búsqueda por voz: "${textoOriginal}"`;

  // Mostramos directamente los resultados
  renderProducts(productosEncontrados, textoOriginal);
  irArriba();

  return true;
}


// Lleva la pantalla al principio (después de buscar, filtrar o elegir una sugerencia)
function irArriba() {
  window.scrollTo(0, 0);
}

function renderProducts(items, query = "", listaCompleta = false) {
  modoListaCompleta = listaCompleta;
  // Al buscar o filtrar, todas las tarjetas van de ancho normal (sin huecos)
  productGrid.classList.toggle("modoBusqueda", !listaCompleta);
  productGrid.replaceChildren();
  const fragment = document.createDocumentFragment();

  if (items.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  const barras = listaCompleta ? barrasDeCategoria(items) : new Map();

  items.forEach((product, posicion) => {
    const tipo = tipoMuestra(product);

    const barra = barras.get(posicion);
    if (barra) fragment.appendChild(crearBarraCategoria(barra.nombre, barra.cantidad));

    if (tipo === "separador") {
      fragment.appendChild(crearSeparador(product));
      return;
    }

    if (tipo === "poster") {
      const poster = crearPoster(product, variedadesPorPoster.get(idProducto(product)) || []);
      scrollObserver.observe(poster);
      fragment.appendChild(poster);
      return;
    }

    const article = crearTarjetaProducto(product);
    scrollObserver.observe(article);
    fragment.appendChild(article);
  });

  productGrid.appendChild(fragment);

  // Desplegables de posters que estaban abiertos: se vuelven a abrir
  productGrid.querySelectorAll(".posterCard").forEach(poster => {
    if (postersAbiertos.has(poster.dataset.posterId)) abrirVariedades(poster, false);
  });

  acomodarHuecos();

  // Carrusel "Ofertas de hoy": solo con la lista completa (js/carrusel-ofertas.js)
  if (typeof actualizarCarruselOfertas === "function") actualizarCarruselOfertas();
}

// Íconos de los chips del producto: hasta MAXIMO_ICONOS_TARJETA y, si hay más, "+N"
// Ícono 3D (imagen: imagenes/chips/…, imagenes/iconos/…) o emoji.
// Sirve para chips, bienvenida y mensajes institucionales.
function esIconoImagen(icono) {
  return /\.(svg|png|webp|jpe?g|gif)$/i.test(String(icono || ""));
}

function crearIconoChip(chip, clase) {
  if (!chip.icono) return null;
  if (esIconoImagen(chip.icono)) {
    const imagen = document.createElement("img");
    imagen.className = clase;
    imagen.src = chip.icono;
    imagen.alt = "";
    imagen.decoding = "async";
    return imagen;
  }
  const emoji = document.createElement("span");
  emoji.className = clase;
  emoji.textContent = chip.icono;
  return emoji;
}

function crearIconosDeChips(product) {
  const chips = chipsDeLaTarjeta(product);
  if (chips.length === 0) return null;

  const contenedor = document.createElement("div");
  contenedor.className = "iconosChips";

  const visibles = chips.length > MAXIMO_ICONOS_TARJETA
    ? chips.slice(0, MAXIMO_ICONOS_TARJETA - 1)
    : chips;

  visibles.forEach(chip => {
    const icono = crearIconoChip(chip, "iconoChip");
    icono.classList.toggle("iconoChipImagen", esIconoImagen(chip.icono));
    icono.title = chip.texto;
    icono.setAttribute("aria-label", chip.texto);
    icono.setAttribute("role", "img");
    contenedor.appendChild(icono);
  });

  const resto = chips.length - visibles.length;
  if (resto > 0) {
    const mas = document.createElement("span");
    mas.className = "iconoChip iconoChipMas";
    mas.textContent = `+${resto}`;
    mas.title = chips.slice(visibles.length).map(chip => chip.texto).join(", ");
    contenedor.appendChild(mas);
  }
  return contenedor;
}

// Arma la tarjeta de un producto (precio, formas de compra, botones)
function crearTarjetaProducto(product) {
    const cardClone = template.content.cloneNode(true);
    const article = cardClone.querySelector(".productCard");
    const image = cardClone.querySelector(".productImage");
    const name = cardClone.querySelector(".name");
    const price = cardClone.querySelector(".price");
    
    const productId = idProducto(product);
    article.dataset.productId = productId;

    // Oferta "Solo x hoy" o rebaja (js/ofertas.js)
    const oferta = ofertaDelProducto(product);
    const cinta = cintaDelProducto(product, oferta);

    // "Solo x hoy" va destacado (2 columnas) solo ese día
    if (product.destacado === true || (oferta && oferta.tipo === "hoy")) {
      article.classList.add("is-featured");
    }

    if (cinta) {
      const ribbonContainer = cardClone.querySelector(".ribbonContainer");
      if (ribbonContainer) {
        ribbonContainer.hidden = false;
        cardClone.querySelector(".ribbonText").textContent = cinta;
      }
    } else {
      const ribbonContainer = cardClone.querySelector(".ribbonContainer");
      if (ribbonContainer) ribbonContainer.hidden = true;
    }

    // Íconos de sus chips (Sin TACC, Niños…) arriba a la derecha
    const iconos = crearIconosDeChips(product);
    if (iconos) article.appendChild(iconos);

    // Corazón de favoritos: en el borde entre la foto y los datos (js/favoritos.js)
    if (typeof crearBotonFavorito === "function") {
      cardClone.querySelector(".productInfo").prepend(crearBotonFavorito(product));
    }

    // Carga diferida: la foto se descarga recién cuando la tarjeta se
    // acerca a la pantalla al deslizar (las de arriba cargan enseguida)
    image.loading = "lazy";
    image.decoding = "async";
    image.src = product.image || categoryImage(product.category);
    // Si la foto no existe o no carga, se muestra el dibujo de la categoría
    image.onerror = () => {
      image.onerror = null;
      image.src = categoryImage(product.category);
    };
    image.alt = product.name;
    name.textContent = product.name;
    price.textContent = formatter.format(precioActual(product));

    const addBtn = cardClone.querySelector(".addBtn");
    
    if (product.inStock) {
      addBtn.textContent = textoBotonAgregar(product);
    } else {
      addBtn.textContent = "Próximamente";
      addBtn.classList.add("outOfStock");
      addBtn.disabled = true;
    }

    prepararFormasDeCompra(article, product);
    decorarConOferta(article, product, oferta);
    updateCardControls(article, product, true);
   
    const plusBtn = cardClone.querySelector(".plusBtn");
    const minusBtn = cardClone.querySelector(".minusBtn");

      addBtn.onclick = () => {
        agregarAlCarrito(product, formaEnTarjeta(product).numero);
        despuesDeCambiarCarrito(article, product, false);
      };
    
      plusBtn.onclick = () => {
        cambiarCantidadEnCarrito(product, +1);
        despuesDeCambiarCarrito(article, product, true);
      };
    
      minusBtn.onclick = () => {
        cambiarCantidadEnCarrito(product, -1);
        despuesDeCambiarCarrito(article, product, false);
      };

    return article;
}

// Cinta de la tarjeta: "Solo x hoy" reemplaza la que tenga (y vuelve sola
// al día siguiente). Una rebaja sin cinta lleva "Rebaja!".
function cintaDelProducto(product, oferta) {
  const propia = String(product.ribbon || "").trim();
  const tienePropia = propia !== "" && propia.toUpperCase() !== "NO";
  if (oferta && oferta.tipo === "hoy") return "Solo x hoy";
  if (oferta && oferta.tipo === "rebaja" && !tienePropia) return "Rebaja!";
  return tienePropia ? propia : "";
}

// Precio tachado y globito "-22%" al lado del precio de oferta
function crearPreciosAntes(oferta, clase = "ofertaAntes") {
  const caja = elemento("span", clase);
  caja.append(
    elemento("s", "ofertaTachado", formatter.format(oferta.antes)),
    elemento("span", "ofertaGlobo", `-${oferta.ahorro}%`)
  );
  return caja;
}

// Tarjeta con oferta: precio grande + tachado + %, borde luminoso
// ("Solo x hoy") y, si se agotó en el día, la franja "AGOTADO!"
function decorarConOferta(article, product, oferta) {
  if (!oferta) return;
  article.classList.add("conOferta", oferta.tipo === "hoy" ? "ofertaHoy" : "ofertaRebaja");

  const precio = article.querySelector(".price");
  const fila = elemento("div", "ofertaPrecios");
  precio.before(fila);

  if (oferta.tipo !== "hoy") {
    fila.append(precio, crearPreciosAntes(oferta));
    return;
  }

  // "Solo x hoy": dos columnas. A la izquierda nombre, precio de oferta
  // c/u y price c/u tachado; a la derecha el botón sello de lacre.
  // El % va en un globito arriba a la derecha de la foto.
  if (!article.classList.contains("conFormas")) {
    precio.replaceChildren(formatter.format(oferta.precio), elemento("small", "precioSufijo", "c/u"));
  }
  const antes = elemento("s", "ofertaTachado");
  antes.append(formatter.format(oferta.antes), elemento("small", "precioSufijo", "c/u"));
  fila.append(precio, antes);

  article.appendChild(elemento("span", "ofertaGlobo ofertaGloboFoto", `-${oferta.ahorro}%`));

  const info = article.querySelector(".productInfo");
  const texto = elemento("div", "ofertaTexto");
  info.querySelector(".name").before(texto);
  texto.append(info.querySelector(".name"), fila);
  const detalle = info.querySelector(".precioDetalle");
  if (detalle) texto.appendChild(detalle);

  article.classList.add("conSello");
  info.appendChild(crearSello(article, product));

  if (!product.inStock) marcarAgotada(article);
}

/* ---------------- BOTÓN SELLO DE LACRE ("Solo x hoy") ----------------
   "¡APROVECHALO!" arriba, "AGREGAR" abajo, el carrito en el medio y el
   step ("x2"). Cada toque suma un step. Con el producto en el pedido,
   en el medio va la cantidad y aparecen − y + a los costados de abajo. */

function asegurarDefsSello() {
  if (document.getElementById("selloDefs")) return;
  // Borde ondulado de la cera
  const puntos = [];
  for (let i = 0; i < 72; i++) {
    const angulo = (i / 72) * Math.PI * 2;
    const r = 92 + 4 * Math.sin(angulo * 7) + 2.5 * Math.sin(angulo * 13 + 1);
    puntos.push(`${(100 + r * Math.cos(angulo)).toFixed(1)},${(100 + r * Math.sin(angulo)).toFixed(1)}`);
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "selloDefs";
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.innerHTML = `
    <defs>
      <radialGradient id="selloOro" cx="38%" cy="32%" r="75%">
        <stop offset="0" stop-color="#fff1b0"/>
        <stop offset=".35" stop-color="#f2c84b"/>
        <stop offset=".75" stop-color="#d49b1c"/>
        <stop offset="1" stop-color="#a8730b"/>
      </radialGradient>
      <radialGradient id="selloCentroOro" cx="40%" cy="35%" r="70%">
        <stop offset="0" stop-color="#ffe58a"/>
        <stop offset=".7" stop-color="#e2ae2c"/>
        <stop offset="1" stop-color="#c28a14"/>
      </radialGradient>
      <filter id="selloSombra" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#5a3a00" flood-opacity=".35"/>
      </filter>
      <path id="selloArcoArriba" d="M 30 100 A 70 70 0 0 1 170 100"/>
      <path id="selloArcoAbajo" d="M 36 106 A 64 64 0 0 0 164 106"/>
      <polygon id="selloCera" points="${puntos.join(" ")}"/>
    </defs>`;
  document.body.appendChild(svg);
}

function crearSello(article, product) {
  asegurarDefsSello();
  const zona = elemento("div", "selloZona");
  const sello = elemento("button", "sello");
  sello.type = "button";

  const forma = formaDeCompra(product, 1);
  const pasoTexto = forma.unidadesPorPaso > 1 && !formaConMedida(forma) ? `x${forma.unidadesPorPaso}` : "";

  sello.innerHTML = `
    <svg class="selloDibujo" viewBox="0 0 200 200" aria-hidden="true">
      <use href="#selloCera" fill="url(#selloOro)" filter="url(#selloSombra)"/>
      <circle cx="100" cy="100" r="76" fill="none" stroke="#a8730b" stroke-width="2.5" opacity=".7"/>
      <circle cx="100" cy="100" r="50" fill="url(#selloCentroOro)" stroke="#a8730b" stroke-width="3"/>
      <ellipse cx="80" cy="62" rx="34" ry="14" fill="#fff" opacity=".28" transform="rotate(-22 80 62)"/>
      <text class="selloTexto"><textPath href="#selloArcoArriba" startOffset="50%" text-anchor="middle">¡APROVECHALO!</textPath></text>
      <text class="selloTexto"><textPath href="#selloArcoAbajo" startOffset="50%" text-anchor="middle">AGREGAR</textPath></text>
      <g class="selloCarrito" fill="none" stroke="#6b4600" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M70 80h10l9 30h28l8-22H84"/>
        <circle cx="93" cy="122" r="5" fill="#6b4600" stroke="none"/>
        <circle cx="114" cy="122" r="5" fill="#6b4600" stroke="none"/>
      </g>
      <text class="selloPaso" x="100" y="146" text-anchor="middle">${pasoTexto}</text>
      <text class="selloCantidad" x="100" y="100" text-anchor="middle" dominant-baseline="central"></text>
    </svg>`;

  const menos = elemento("button", "selloMenos", "−");
  menos.type = "button";
  menos.setAttribute("aria-label", `Quitar ${product.name}`);
  const mas = elemento("button", "selloMas", "+");
  mas.type = "button";
  mas.setAttribute("aria-label", `Sumar ${product.name}`);

  const latido = () => {
    sello.classList.remove("latido");
    void sello.offsetWidth;
    sello.classList.add("latido");
  };

  sello.onclick = () => {
    if (!product.inStock) return;
    if (cart[idProducto(product)]) cambiarCantidadEnCarrito(product, +1);
    else agregarAlCarrito(product, 1);
    latido();
    despuesDeCambiarCarrito(article, product, true);
  };
  mas.onclick = sello.onclick;
  menos.onclick = () => {
    cambiarCantidadEnCarrito(product, -1);
    despuesDeCambiarCarrito(article, product, true);
  };

  zona.append(sello, menos, mas);
  return zona;
}

function actualizarSello(article, product) {
  const zona = article.querySelector(".selloZona");
  if (!zona) return;
  const sello = zona.querySelector(".sello");
  const cantidad = cart[idProducto(product)] || 0;
  const agotado = !product.inStock;
  zona.classList.toggle("enPedido", cantidad > 0);
  zona.classList.toggle("agotado", agotado);
  sello.disabled = agotado;

  const texto = agotado ? "AGOTADO" : (cantidad ? textoCantidad(formaEnCarrito(product), cantidad) : "");
  const nodo = sello.querySelector(".selloCantidad");
  nodo.textContent = texto;
  nodo.classList.toggle("largo", texto.length > 3);
  sello.setAttribute("aria-label", agotado
    ? `${product.name}: agotado`
    : (cantidad ? `${product.name}: ${texto} en el pedido. Sumar más` : `Agregar ${product.name}`));
}

function marcarAgotada(tarjeta) {
  tarjeta.classList.add("ofertaAgotada");
  const franja = elemento("div", "ofertaAgotadaFranja");
  franja.appendChild(elemento("span", "", "AGOTADO!"));
  tarjeta.appendChild(franja);
  const boton = tarjeta.querySelector(".addBtn");
  if (boton) boton.textContent = "Agotado";
}

// Después de agregar, sumar, restar o cambiar de forma
function despuesDeCambiarCarrito(article, product, instant) {
  saveCart();
  updateCardControls(article, product, instant);
  actualizarFormasDeCompra(article, product, false);
  updateWhatsAppLink();
  updateCheckoutUI();
}

function textoBotonAgregar(product) {
  const formas = formasDeCompra(product);
  const forma1 = formas[0];
  if (formas.length === 2) return "Agregar";
  if (formaConMedida(forma1)) return `Agregar ${forma1.medida}`;
  if (forma1.unidadesPorPaso > 1) return `Agregar (x${forma1.unidadesPorPaso})`;
  return "Agregar";
}

// Arma un texto de config.js reemplazando {clave} por texto o elementos
function armarTexto(plantilla, valores) {
  const fragmento = document.createDocumentFragment();
  String(plantilla).split(/(\{\w+\})/).forEach(parte => {
    const clave = parte.match(/^\{(\w+)\}$/)?.[1];
    const valor = clave ? valores[clave] : parte;
    if (valor === undefined || valor === "") return;
    fragmento.append(valor instanceof Node ? valor : document.createTextNode(valor));
  });
  return fragmento;
}

function elemento(etiqueta, clase, texto) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

// Agrega a la tarjeta las formas de compra.
// Los productos con un solo precio por unidad quedan como siempre.
//
//   [ Unidad │ Caja ]          ← interruptor
//   $799 c/u    $719 c/u       ← columnas (la de caja en rojo)
//   por unidad  por caja 12u
//   Estás ahorrando 10%...     ← solo con la forma 2 elegida
function prepararFormasDeCompra(article, product) {
  const formas = formasDeCompra(product);
  if (formas.length === 1 && !formaConMedida(formas[0])) return;

  article.classList.add("conFormas");

  const precio = article.querySelector(".price");
  const detalle = elemento("span", "precioDetalle");

  if (formas.length === 1) {
    // Un solo precio, pero por bulto/caja: precio + "por bulto 10u"
    precio.after(detalle);
    actualizarFormasDeCompra(article, product, false);
    return;
  }

  article.classList.add("dosFormas");
  const mismoPrecio = formas[1].mismoPrecio;
  if (mismoPrecio) article.classList.add("mismoPrecio");

  const selector = elemento("div", "formaSelector");
  selector.setAttribute("role", "group");
  selector.setAttribute("aria-label", "Forma de compra");
  selector.appendChild(elemento("span", "formaPastilla"));

  const columnas = elemento("div", "formaColumnas");

  formas.forEach(forma => {
    const boton = elemento("button", "");
    boton.appendChild(elemento("span", "formaBotonTexto", forma.corta));
    // Badge "8%" en el botón de la forma 2 (se oculta al elegirla)
    if (forma.numero === 2 && forma.ahorro > 0) {
      boton.appendChild(elemento("span", "badgeAhorro badgeBoton", `${forma.ahorro}%`));
    }
    boton.type = "button";
    boton.dataset.forma = String(forma.numero);
    boton.title = forma.etiqueta;
    boton.onclick = () => elegirFormaDeCompra(article, product, forma.numero);
    selector.appendChild(boton);

    // Columna: precio, texto y (con el producto en el carrito) el subtotal
    const columna = elemento("button", "formaColumna");
    columna.type = "button";
    columna.dataset.forma = String(forma.numero);
    const subtotal = elemento("span", "formaSubtotal");
    subtotal.hidden = true;
    columna.append(
      elemento("span", "formaPrecio"),
      elemento("span", "formaTexto", forma.columna),
      subtotal
    );
    if (forma.numero === 2) columna.classList.add("tentador");
    columna.onclick = () => elegirFormaDeCompra(article, product, forma.numero);
    columnas.appendChild(columna);
  });

  const pista = elemento("p", "formaPista");
  precio.before(selector);

  if (mismoPrecio) {
    // Mismo precio: un solo precio centrado debajo del interruptor
    precio.after(detalle);
    detalle.after(pista);
  } else {
    precio.hidden = true;
    precio.after(columnas);
    columnas.after(pista);
  }
  pista.after(crearPreguntaMenos(article, product));

  actualizarFormasDeCompra(article, product, false);
}

// "¿Querés comprar menos de 1 caja?" dentro de la tarjeta
function crearPreguntaMenos(article, product) {
  const [forma1, forma2] = formasDeCompra(product);
  const textos = CLIENTE.precios || {};
  const nombreForma1 = formaConMedida(forma1) ? forma1.medida : "unidad";

  const caja = elemento("div", "formaPregunta");
  caja.hidden = true;
  caja.setAttribute("role", "alertdialog");

  const cantidad = formaConMedida(forma2)
    ? textoCantidad(forma2, unidadesMinimas(forma2))   // "1 caja", "5 bultos"
    : `${unidadesMinimas(forma2)} unidades`;           // "24 unidades"

  const texto = elemento("p", "formaPreguntaTexto");
  texto.textContent = textoCliente(
    textos.textoPregunta || "¿Querés comprar menos de {cantidad}?",
    { cantidad }
  );

  const si = elemento("button", "formaPreguntaSi",
    textoCliente(textos.textoPreguntaSi || "Sí, por {forma1}", { forma1: nombreForma1 }));
  si.type = "button";
  si.onclick = () => {
    caja.hidden = true;
    cambiarFormaEnCarrito(product, 1);
    despuesDeCambiarCarrito(article, product, true);
    actualizarFormasDeCompra(article, product, true);
  };

  const no = elemento("button", "formaPreguntaNo", textos.textoPreguntaNo || "No");
  no.type = "button";
  no.onclick = () => {
    caja.hidden = true;
  };

  const botones = elemento("div", "formaPreguntaBotones");
  botones.append(si, no);
  caja.append(texto, botones);
  return caja;
}

function elegirFormaDeCompra(article, product, numeroForma) {
  const actual = formaEnTarjeta(product).numero;
  if (actual === numeroForma) return;

  const id = idProducto(product);

  // Tiene cajas en el carrito y quiere pasar a unidades: preguntar primero
  if (cart[id] && actual === 2 && numeroForma === 1) {
    const pregunta = article.querySelector(".formaPregunta");
    if (pregunta) {
      pregunta.hidden = false;
      pregunta.querySelector(".formaPreguntaSi").focus({ preventScroll: true });
      return;
    }
  }

  if (cart[id]) {
    cambiarFormaEnCarrito(product, numeroForma);
    despuesDeCambiarCarrito(article, product, true);
  } else {
    opcionEnTarjeta[id] = numeroForma;
  }

  actualizarFormasDeCompra(article, product, true);
}

// Texto del precio de una forma ("$719" + "c/u", o el total de la medida)
function precioDeForma(forma) {
  const porMedida =
    CLIENTE.precios?.mostrarPrecioPor === "medida" && formaConMedida(forma);
  const nodo = document.createDocumentFragment();
  nodo.append(formatter.format(
    porMedida ? forma.precioUnitario * forma.unidadesPorPaso : forma.precioUnitario
  ));
  if (!porMedida) nodo.append(elemento("small", "precioSufijo", "c/u"));
  return nodo;
}

// Cuánto vale una caja/bulto/pallet completo: "$26.388",
// o con nombre: "Caja $26.388". Vacío si se vende por unidad suelta.
function precioDeLaMedida(forma, conNombre) {
  if (forma.unidadesPorPaso <= 1) return "";
  const monto = formatter.format(forma.precioUnitario * forma.unidadesPorPaso);
  if (!conNombre) return monto;
  const nombre = formaConMedida(forma)
    ? capitalizar(forma.medida)
    : `x${forma.unidadesPorPaso}`;
  return `${nombre} ${monto}`;
}

// Actualiza precios, columnas, detalle y textos según la forma actual
function actualizarFormasDeCompra(article, product, animar) {
  if (!article.classList.contains("conFormas")) return;

  const formas = formasDeCompra(product);
  const forma = formaEnTarjeta(product);
  const id = idProducto(product);
  const enCarrito = cart[id] || 0;
  const detalle = article.querySelector(".precioDetalle");

  // Detalle: lo que lleva en el carrito ("24 u. · $17.256")
  const textoCarrito = enCarrito && formaConMedida(forma)
    ? `${enCarrito} u. · ${formatter.format(enCarrito * forma.precioUnitario)}`
    : "";

  // ---- Un solo precio por bulto/caja ----
  if (formas.length === 1) {
    const precio = article.querySelector(".price");
    precio.replaceChildren(precioDeForma(forma));
    detalle.textContent = textoCarrito || forma.columna;
    return;
  }

  // ---- Dos formas ----
  const selector = article.querySelector(".formaSelector");
  selector.dataset.forma = String(forma.numero);
  selector.querySelectorAll("button").forEach(boton => {
    boton.setAttribute("aria-pressed", String(Number(boton.dataset.forma) === forma.numero));
  });

  if (formas[1].mismoPrecio) {
    // Un solo precio centrado y debajo, siempre, cuánto vale una caja
    article.querySelector(".price").replaceChildren(precioDeForma(forma));
    const textoMedida = precioDeLaMedida(formas[1], true);
    detalle.textContent = textoMedida;
    detalle.hidden = !textoMedida;
  } else {
    article.querySelectorAll(".formaColumna").forEach(columna => {
      const numero = Number(columna.dataset.forma);
      const esActual = numero === forma.numero;
      columna.querySelector(".formaPrecio").replaceChildren(precioDeForma(formas[numero - 1]));
      columna.classList.toggle("activa", esActual);
      columna.setAttribute("aria-pressed", String(esActual));

      // Subtotal ("12 u. · $26.388") debajo de la forma que está en el carrito
      // Siempre: cuánto vale una caja/bulto/pallet completo ("$26.388")
      const subtotal = columna.querySelector(".formaSubtotal");
      const textoMedida = precioDeLaMedida(formas[numero - 1], false);
      subtotal.textContent = textoMedida;
      subtotal.hidden = !textoMedida;

      if (animar && esActual) {
        columna.classList.remove("cambiando");
        void columna.offsetWidth;
        columna.classList.add("cambiando");
      }
    });
  }

  // Badge "8%" en el botón de la caja mientras no esté elegida.
  // Al elegirla, el badge se va y aparece "Estás ahorrando 8% frente a unidad".
  const [forma1, forma2] = formas;
  const badge = selector.querySelector(".badgeBoton");
  if (badge) badge.hidden = forma.numero === 2;

  const pista = article.querySelector(".formaPista");
  if (forma.numero === 2 && forma2.ahorro > 0) {
    pista.replaceChildren(armarTexto(
      CLIENTE.precios?.textoAhorro || "Estás ahorrando {ahorro} frente a {forma1}",
      {
        ahorro: elemento("span", "badgeAhorro", `${forma2.ahorro}%`),
        forma1: formaConMedida(forma1) ? forma1.medida : "unidad"
      }
    ));
    pista.hidden = false;
  } else {
    pista.replaceChildren();
    pista.hidden = true;
  }

  // Cualquier cambio cierra la pregunta
  const pregunta = article.querySelector(".formaPregunta");
  if (pregunta && !(enCarrito && forma.numero === 2)) pregunta.hidden = true;
}

// ---------------------------------------------------------
// SEPARADORES Y POSTERS (campo TipoMuestra, ver js/datos.js)
// ---------------------------------------------------------

// Título de sección: el texto sale del campo name
function crearSeparador(product) {
  return crearBarraCategoria(product.name || "", null);
}

/* ---------------------------------------------------------
   BARRAS DE CATEGORÍA Y HUECOS
   Solo con la lista completa (sin buscar ni filtrar).
   - Cada vez que cambia la categoría va una barra con el nombre.
     Si justo antes hay un separador manual, manda el manual.
   - Una tarjeta destacada (ancho doble) que no entra en la fila
     deja un hueco. Se tapa así, según lo que viene después:
       barra de categoría → imagen o mensaje institucional (cliente/config.js)
       poster destacado   → el poster se muestra de ancho normal
       producto destacado → tarjeta con la manito 👇 que lo señala
   ------------------------------------------------------- */

// Posición en la lista → { nombre, cantidad } donde empieza cada categoría
function barrasDeCategoria(items) {
  const barras = new Map();
  let categoria = null;
  let anteriorEsSeparador = false;
  let barraActual = null;

  items.forEach((product, posicion) => {
    const tipo = tipoMuestra(product);
    if (tipo === "separador") {
      anteriorEsSeparador = true;
      return;
    }

    const nombre = String(product.category || "").trim();
    if (nombre && normalize(nombre) !== categoria) {
      categoria = normalize(nombre);
      barraActual = anteriorEsSeparador ? null : { nombre, cantidad: 0 };
      if (barraActual) barras.set(posicion, barraActual);
    }
    anteriorEsSeparador = false;

    if (barraActual) {
      barraActual.cantidad += tipo === "poster"
        ? (variedadesPorPoster.get(idProducto(product)) || []).length
        : 1;
    }
  });

  return barras;
}

function crearBarraCategoria(nombre, cantidad) {
  const barra = document.createElement("div");
  barra.className = "catalogoSeparador";
  barra.dataset.nombre = nombre;
  if (cantidad) barra.dataset.cantidad = cantidad;
  const titulo = document.createElement("h2");
  titulo.textContent = nombre;
  barra.appendChild(titulo);
  return barra;
}

function columnasDeLaGrilla() {
  const columnas = getComputedStyle(productGrid).gridTemplateColumns
    .split(" ")
    .filter(Boolean).length;
  return columnas || 1;
}

function anchoEnGrilla(elemento, columnas) {
  if (elemento.classList.contains("catalogoSeparador")) return columnas;
  if (elemento.classList.contains("rellenoHueco")) return Number(elemento.dataset.ancho) || 1;
  if (elemento.classList.contains("is-featured") && !elemento.classList.contains("posterAchicado")) {
    return Math.min(2, columnas);
  }
  return 1;
}

// Recorre la grilla como la acomoda el navegador y tapa los huecos.
// Se vuelve a calcular al abrir/cerrar variedades y al cambiar el ancho.
function acomodarHuecos() {
  productGrid.querySelectorAll(".rellenoHueco").forEach(relleno => {
    observadorInstitucional.unobserve(relleno);
    relleno.remove();
  });
  productGrid.querySelectorAll(".posterAchicado").forEach(poster => poster.classList.remove("posterAchicado"));

  if (!modoListaCompleta) return;

  const columnas = columnasDeLaGrilla();
  if (columnas < 2) return;

  let columna = 0;
  let turnoInstitucional = 0;   // los mensajes se van turnando en orden
  [...productGrid.children].forEach(elemento => {
    if (elemento.classList.contains("variedadSaliendo")) return;

    let ancho = anchoEnGrilla(elemento, columnas);
    const libres = columnas - columna;

    if (columna > 0 && ancho > libres) {
      if (elemento.classList.contains("posterCard")) {
        elemento.classList.add("posterAchicado");
        ancho = 1;
      } else if (elemento.classList.contains("catalogoSeparador")) {
        const relleno = crearInstitucional(turnoInstitucional, libres, elemento.dataset.nombre);
        if (relleno) {
          elemento.before(relleno);
          turnoInstitucional++;
        }
        columna = 0;
      } else if (elemento.classList.contains("is-featured")) {
        elemento.before(crearManito(elemento, libres));
        columna = 0;
      } else {
        columna = 0;
      }
    }

    columna += ancho;
    if (columna >= columnas) columna = 0;
  });
}

/* Mensajes institucionales (cliente/config.js → institucional)
   Llenan el hueco que queda antes de una barra de categoría.
   Cada mensaje puede tener una foto (formato historia, 1080×1920) y/o
   un texto. Con foto se muestra la foto; sin foto, la tarjeta de texto.
   Entran desde la derecha la primera vez que aparecen en pantalla. */

// (Las constantes de los mensajes están arriba de todo, junto a modoListaCompleta)

function crearInstitucional(turno, ancho, clave) {
  // Sin mensajes cargados, se muestra el logo de la empresa
  const mensaje = INSTITUCIONAL.length > 0
    ? INSTITUCIONAL[turno % INSTITUCIONAL.length]
    : {};

  const tarjeta = document.createElement("div");
  tarjeta.className = "rellenoHueco institucional";
  tarjeta.dataset.ancho = ancho;
  tarjeta.dataset.clave = clave || String(turno);
  tarjeta.style.gridColumn = `span ${ancho}`;

  const contenido = document.createElement("div");
  contenido.className = "institucionalContenido";
  tarjeta.appendChild(contenido);

  if (mensaje.imagen) {
    const imagen = document.createElement("img");
    imagen.className = "institucionalImagen";
    imagen.src = CARPETA_INSTITUCIONAL + mensaje.imagen;
    imagen.alt = [mensaje.titulo, mensaje.texto].filter(Boolean).join(". ");
    imagen.loading = "lazy";
    // Si la foto no está, se muestra el texto (o el logo de la empresa)
    imagen.onerror = () => {
      imagen.remove();
      llenarTextoInstitucional(contenido, mensaje);
    };
    contenido.appendChild(imagen);
  } else {
    llenarTextoInstitucional(contenido, mensaje);
  }

  if (institucionalesVistos.has(tarjeta.dataset.clave)) {
    tarjeta.classList.add("institucionalVisto");
  } else {
    observadorInstitucional.observe(tarjeta);
  }
  return tarjeta;
}

function llenarTextoInstitucional(contenido, mensaje) {
  contenido.classList.add("institucionalTexto");
  const titulo = mensaje.titulo || "";
  const texto = mensaje.texto || "";

  if (mensaje.icono) {
    contenido.appendChild(crearIconoChip(mensaje, "institucionalIcono"));
  } else if (!titulo && !texto && CLIENTE.empresa?.logo) {
    contenido.appendChild(Object.assign(document.createElement("img"), {
      className: "institucionalLogo", src: CLIENTE.empresa.logo, alt: CLIENTE.empresa.nombre || ""
    }));
  }
  if (titulo) {
    contenido.appendChild(Object.assign(document.createElement("strong"), {
      className: "institucionalTitulo", textContent: textoCliente(titulo, VARIABLES_INSTITUCIONAL)
    }));
  }
  if (texto) {
    contenido.appendChild(Object.assign(document.createElement("span"), {
      className: "institucionalDetalle", textContent: textoCliente(texto, VARIABLES_INSTITUCIONAL)
    }));
  }
}

// Tarjeta con la manito que señala al destacado de abajo
function crearManito(destacado, ancho) {
  const manito = document.createElement("button");
  manito.type = "button";
  manito.className = "rellenoHueco manitoDestacado";
  manito.dataset.ancho = ancho;
  manito.style.gridColumn = `span ${ancho}`;

  const cinta = destacado.querySelector(".ribbonContainer:not([hidden]) .ribbonText");
  const texto = cinta?.textContent.trim() || "¡Mirá esta oferta!";

  manito.innerHTML = `
    <span class="manitoTexto"></span>
    <img class="manitoMano" src="imagenes/iconos/mano.svg" alt="" aria-hidden="true">
    <span class="manitoPista">Mirá acá abajo</span>`;
  manito.querySelector(".manitoTexto").textContent = texto;
  manito.setAttribute("aria-label", `${texto}: ir al producto destacado`);

  manito.onclick = () => {
    destacado.scrollIntoView({ behavior: "smooth", block: "center" });
    destacado.classList.remove("destacadoSenalado");
    void destacado.offsetWidth;
    destacado.classList.add("destacadoSenalado");
    setTimeout(() => destacado.classList.remove("destacadoSenalado"), 1400);
  };
  return manito;
}

// Al pasar de celular a computadora (o girar la tablet) cambian las columnas
let columnasActuales = 0;
window.addEventListener("resize", () => {
  const columnas = columnasDeLaGrilla();
  if (columnas !== columnasActuales) {
    columnasActuales = columnas;
    acomodarHuecos();
  }
});

function palabrasClave(texto) {
  return normalize(texto).split(/[\s,;]+/).filter(Boolean);
}

// Un producto es variedad de un poster si sus keywords contienen
// todas las palabras de los keywords del poster.
// Si coincide con dos posters, queda en el primero.
function agruparVariedades(lista) {
  const grupos = new Map();
  const asignados = new Set();

  lista.forEach(item => {
    if (tipoMuestra(item) !== "poster") return;
    const palabrasPoster = palabrasClave(item.keywords);
    if (palabrasPoster.length === 0) return;

    const variedades = productosVendibles.filter(product => {
      const id = idProducto(product);
      if (asignados.has(id)) return false;
      const palabrasProducto = new Set(palabrasClave(product.keywords));
      return palabrasPoster.every(palabra => palabrasProducto.has(palabra));
    });

    variedades.forEach(product => asignados.add(idProducto(product)));
    // Las sin stock al final
    grupos.set(idProducto(item), ordenarSinStockAlFinal(variedades));
  });

  return {
    grupos,
    lista: lista.filter(item => !(esProducto(item) && asignados.has(idProducto(item))))
  };
}

// Poster: la imagen sin precio ni "Agregar". Encima, abajo y centrado,
// el botón "Ver variedades" que despliega sus productos debajo.
function crearPoster(product, variedades) {
  const poster = document.createElement("article");
  poster.className = "productCard posterCard";
  poster.dataset.posterId = idProducto(product);
  if (product.destacado === true) poster.classList.add("is-featured");

  const marco = document.createElement("div");
  marco.className = "posterMarco";

  const imagen = document.createElement("img");
  imagen.className = "posterImagen";
  imagen.src = product.image || categoryImage(product.category);
  imagen.alt = product.name || "";
  imagen.loading = "lazy";
  imagen.onerror = () => {
    imagen.onerror = null;
    imagen.src = categoryImage(product.category);
  };
  marco.appendChild(imagen);

  // Precio de las variedades, solo si todas cuestan lo mismo.
  // Así el poster no tiene el precio dibujado y nunca queda desactualizado.
  // Si además todas tienen el mismo precio mayorista (PrecioPorVolumen),
  // se muestra el mayorista con su condición al lado ("desde 2u",
  // "por caja 12u"). El precio por unidad no se muestra (confundía).
  // Oferta de las variedades (todas al mismo precio): el poster la toma.
  // "Solo x hoy": destacado, con la cinta, el borde luminoso y el precio
  // de oferta con el tachado y el %.
  const ofertaComun = ofertaComunDeVariedades(variedades);
  const mayoristaComun = ofertaComun ? null : mayoristaComunDeVariedades(variedades);
  const precioComun = precioComunDeVariedades(variedades);
  if (ofertaComun) {
    poster.classList.add("conOferta", ofertaComun.tipo === "hoy" ? "ofertaHoy" : "ofertaRebaja");
    if (ofertaComun.tipo === "hoy") poster.classList.add("is-featured");

    const cinta = document.createElement("div");
    cinta.className = "ribbonContainer";
    cinta.appendChild(elemento("span", "ribbonText", ofertaComun.tipo === "hoy" ? "Solo x hoy" : "Rebaja!"));
    poster.appendChild(cinta);

    const etiqueta = document.createElement("span");
    etiqueta.className = "posterPrecio conCondicion posterPrecioOferta";
    etiqueta.append(formatter.format(ofertaComun.precio));
    const sufijo = document.createElement("small");
    sufijo.className = "posterPrecioSufijo";
    sufijo.append(elemento("span", "", "c/u"), elemento("s", "posterPrecioAntes", formatter.format(ofertaComun.antes)));
    etiqueta.appendChild(sufijo);
    etiqueta.appendChild(elemento("span", "ofertaGlobo posterGlobo", `-${ofertaComun.ahorro}%`));
    marco.appendChild(etiqueta);
    poster.classList.add("conPrecio");

    if (ofertaComun.tipo === "hoy" && variedades.every(product => !product.inStock)) {
      marcarAgotada(poster);
    }
  } else if (mayoristaComun) {
    const etiqueta = document.createElement("span");
    etiqueta.className = "posterPrecio conCondicion";
    etiqueta.append(formatter.format(mayoristaComun.mayorista.precioUnitario));
    const sufijo = document.createElement("small");
    sufijo.className = "posterPrecioSufijo";
    const cu = document.createElement("span");
    cu.textContent = "c/u";
    const condicion = document.createElement("span");
    condicion.className = "posterPrecioCondicion";
    condicion.textContent = mayoristaComun.mayorista.columna;
    sufijo.append(cu, condicion);
    etiqueta.appendChild(sufijo);
    marco.appendChild(etiqueta);
    poster.classList.add("conPrecio", "conMayorista");
  } else if (precioComun !== null) {
    const etiqueta = document.createElement("span");
    etiqueta.className = "posterPrecio";
    etiqueta.append(formatter.format(precioComun));
    const sufijo = document.createElement("small");
    sufijo.textContent = "c/u";
    etiqueta.appendChild(sufijo);
    marco.appendChild(etiqueta);
    poster.classList.add("conPrecio");
  }

  if (variedades.length > 0) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "posterVariedades";
    boton.setAttribute("aria-expanded", "false");
    boton.innerHTML = `
      <span class="posterVariedadesTexto">Ver variedades</span>
      <span class="posterVariedadesCantidad">${variedades.length}</span>
      <svg class="posterVariedadesFlecha" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    boton.onclick = () => {
      if (poster.classList.contains("abierto")) cerrarVariedades(poster);
      else abrirVariedades(poster, true);
    };
    marco.appendChild(boton);
  }

  poster.appendChild(marco);
  return poster;
}

// Formas de compra comunes a todas las variedades cuando tienen precio
// mayorista: mismo precio por unidad, mismo precio mayorista y misma
// condición. Si alguna es distinta (o no tiene mayorista), null.
function mayoristaComunDeVariedades(variedades) {
  if (!variedades || variedades.length === 0) return null;
  let comun = null;
  for (const product of variedades) {
    const formas = formasDeCompra(product);
    if (formas.length !== 2 || formas[1].mismoPrecio) return null;
    const [minorista, mayorista] = formas;
    const clave = [minorista.precioUnitario, minorista.columna, mayorista.precioUnitario, mayorista.columna].join("|");
    if (comun === null) comun = { clave, minorista, mayorista };
    else if (comun.clave !== clave) return null;
  }
  return comun;
}

// Precio por unidad común a todas las variedades, o null si hay más de uno
function precioComunDeVariedades(variedades) {
  if (!variedades || variedades.length === 0) return null;
  const precios = new Set(variedades.map(product => formasDeCompra(product)[0].precioUnitario));
  return precios.size === 1 ? [...precios][0] : null;
}

// Inserta las tarjetas de las variedades justo después del poster
function abrirVariedades(poster, animar) {
  const variedades = variedadesPorPoster.get(poster.dataset.posterId) || [];
  if (variedades.length === 0) return;

  let anterior = poster;
  variedades.forEach((product, posicion) => {
    const tarjeta = crearTarjetaProducto(product);
    tarjeta.classList.add("variedad", "animate-in");
    // La oferta destaca al poster; sus variedades van de ancho normal
    if (product.destacado !== true) tarjeta.classList.remove("is-featured");
    tarjeta.dataset.variedadDe = poster.dataset.posterId;
    if (animar) {
      tarjeta.classList.add("variedadEntrando");
      tarjeta.style.animationDelay = `${Math.min(posicion, 8) * 40}ms`;
    }
    anterior.after(tarjeta);
    anterior = tarjeta;
  });

  poster.classList.add("abierto");
  postersAbiertos.add(poster.dataset.posterId);
  const boton = poster.querySelector(".posterVariedades");
  boton.setAttribute("aria-expanded", "true");
  // En los posters angostos del celular, "variedades" se oculta (ver styles.css)
  boton.querySelector(".posterVariedadesTexto").innerHTML = 'Ocultar<span class="posterTextoExtra"> variedades</span>';

  if (animar) acomodarHuecos();
}

function cerrarVariedades(poster) {
  const tarjetas = productGrid.querySelectorAll(
    `.variedad[data-variedad-de="${CSS.escape(poster.dataset.posterId)}"]`
  );
  tarjetas.forEach(tarjeta => {
    tarjeta.classList.remove("variedadEntrando");
    tarjeta.classList.add("variedadSaliendo");
    setTimeout(() => tarjeta.remove(), 220);
  });
  // Cuando terminan de irse, se vuelven a tapar los huecos
  setTimeout(acomodarHuecos, 230);

  poster.classList.remove("abierto");
  postersAbiertos.delete(poster.dataset.posterId);
  const boton = poster.querySelector(".posterVariedades");
  boton.setAttribute("aria-expanded", "false");
  boton.querySelector(".posterVariedadesTexto").textContent = "Ver variedades";
}

// Mantiene el orden comercial, pero manda los productos sin stock al final
// de su sección. Los separadores y posters quedan donde están.
function ordenarSinStockAlFinal(lista, porCategoria = false) {
  const resultado = [];
  let conStock = [];
  let sinStock = [];
  let categoria = null;

  const cerrarSeccion = () => {
    resultado.push(...conStock, ...sinStock);
    conStock = [];
    sinStock = [];
  };

  lista.forEach(item => {
    if (tipoMuestra(item) === "separador") {
      cerrarSeccion();
      resultado.push(item);
      return;
    }
    if (porCategoria) {
      const nombre = normalize(String(item.category || "").trim());
      if (nombre && nombre !== categoria) {
        if (categoria !== null) cerrarSeccion();
        categoria = nombre;
      }
    }
    if (esProducto(item) && !item.inStock) {
      sinStock.push(item);
    } else {
      conStock.push(item);
    }
  });

  cerrarSeccion();
  return resultado;
}

function updateCardControls(article, product, instant = false) {
  if (article.classList.contains("conSello")) actualizarSello(article, product);
  const addBtn = article.querySelector(".addBtn");
  const counterControls = article.querySelector(".counterControls");
  const quantityValue = article.querySelector(".quantityValue");
  
  if (!product.inStock) {
    addBtn.classList.remove("is-hidden");
    counterControls.classList.add("is-hidden");
    return;
  }
  
  const productId = idProducto(product);
  const currentQty = cart[productId] || 0;

  if (currentQty > 0) {
    const forma = formaEnCarrito(product);
    quantityValue.textContent = textoCantidad(forma, currentQty);
    quantityValue.classList.toggle("conMedida", formaConMedida(forma));
    if (instant) {
      addBtn.classList.add("is-hidden");
      counterControls.classList.remove("is-hidden");
    } else {
      addBtn.classList.add("fade-out");
      setTimeout(() => {
        addBtn.classList.add("is-hidden");
        addBtn.classList.remove("fade-out");
        counterControls.classList.remove("is-hidden");
      }, 180);
    }
  } else {
    if (instant) {
      addBtn.classList.remove("is-hidden");
      counterControls.classList.add("is-hidden");
    } else {
      counterControls.classList.add("fade-out");
      setTimeout(() => {
        counterControls.classList.add("is-hidden");
        counterControls.classList.remove("fade-out");
        addBtn.classList.remove("is-hidden");
      }, 180);
    }
  }
}

// ---------------------------------------------------------
// GUARDAR EL CARRITO EN EL CELULAR
// Se guarda por Id, junto con el precio y el nombre que tenía
// cada producto, para avisar al cliente si algo cambió.
// ---------------------------------------------------------

function saveCart() {
  try {
    if (Object.keys(cart).length === 0) {
      localStorage.removeItem(CART_STORAGE_KEY);
      return;
    }

    const precios = {};
    const nombres = {};

    Object.keys(cart).forEach(id => {
      const product = productoPorId(id);
      if (product) {
        precios[id] = precioUnitarioEnCarrito(product);
        nombres[id] = product.name;
      }
    });

    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ items: cart, opciones: cartOpcion, precios, nombres })
    );
  } catch (e) {
    // Sin almacenamiento disponible: el carrito sigue funcionando en memoria.
  }
}

function loadCart() {
  let guardado = null;

  try {
    guardado = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
  } catch (e) {
    guardado = null;
  }

  if (!guardado) {
    guardado = migrarCarritoViejo();
  }

  if (!guardado || !guardado.items) return;

  Object.assign(cart, guardado.items);
  Object.assign(cartOpcion, guardado.opciones || {});

  cambiosCarrito = sincronizarCarrito(
    guardado.precios || {},
    guardado.nombres || {}
  );

  saveCart();
}

// El formato anterior guardaba la POSICIÓN del producto en la lista
// (clave "cart"). Se convierte una sola vez al formato nuevo por Id.
function migrarCarritoViejo() {
  try {
    const viejo = JSON.parse(localStorage.getItem("cart"));
    localStorage.removeItem("cart");

    if (!viejo || typeof viejo !== "object") return null;

    const items = {};

    Object.entries(viejo).forEach(([posicion, cantidad]) => {
      const product = products[parseInt(posicion, 10)];
      if (product && cantidad > 0) {
        items[idProducto(product)] = cantidad;
      }
    });

    return { items };
  } catch (e) {
    return null;
  }
}

// Compara el carrito guardado con los datos actuales de products-data.js:
// - quita productos que ya no existen o que se quedaron sin stock
// - ajusta la cantidad si cambió la compra mínima (step)
// - avisa si cambió el precio (el total siempre usa el precio actual)
function sincronizarCarrito(preciosGuardados, nombresGuardados) {
  const cambios = [];

  Object.keys(cart).forEach(id => {
    const product = productoPorId(id);
    const cantidad = Number(cart[id]) || 0;

    if (!product || !esProducto(product)) {
      quitarDelCarrito(id);
      cambios.push(
        `Se quitó "${nombresGuardados[id] || "un producto"}": ya no está en el catálogo.`
      );
      return;
    }

    if (!product.inStock) {
      quitarDelCarrito(id);
      cambios.push(`Se quitó "${product.name}": sin stock por el momento.`);
      return;
    }

    if (cantidad <= 0) {
      quitarDelCarrito(id);
      return;
    }

    // Si se eligió la forma 2 y el producto ya no la tiene, pasa a la forma 1
    const forma = formaEnCarrito(product);
    let avisarPrecio = true;

    if ((cartOpcion[id] || 1) !== forma.numero) {
      delete cartOpcion[id];
      avisarPrecio = false;
      cambios.push(
        `"${product.name}": ya no tiene precio por cantidad, quedó a ${formatter.format(forma.precioUnitario)} c/u.`
      );
    }

    // Si por unidades ya alcanza para la forma 2, pasa a la forma 2
    const formas = formasDeCompra(product);
    if (
      forma.numero === 1 &&
      formas.length === 2 &&
      cantidad >= unidadesMinimas(formas[1])
    ) {
      cart[id] = unidadesMinimas(formas[1]);
      guardarFormaEnCarrito(id, formas[1]);
      if (!formas[1].mismoPrecio) {
        cambios.push(
          `"${product.name}": pasó a ${textoCantidadPedido(formas[1], cart[id])}, al mejor precio.`
        );
      }
      return;
    }

    const paso = forma.unidadesPorPaso;
    const minimo = unidadesMinimas(forma);

    if (cantidad % paso !== 0 || cantidad < minimo) {
      cart[id] = Math.max(minimo, Math.ceil(cantidad / paso) * paso);
      cambios.push(
        formaConMedida(forma)
          ? `"${product.name}": la cantidad pasó a ${textoCantidad(forma, cart[id])} (${cart[id]} u.).`
          : `"${product.name}": se vende de a ${paso}, la cantidad pasó a ${cart[id]}.`
      );
    }

    const precioAnterior = preciosGuardados[id];

    if (
      avisarPrecio &&
      typeof precioAnterior === "number" &&
      precioAnterior !== forma.precioUnitario
    ) {
      cambios.push(
        `"${product.name}" cambió de precio: ${formatter.format(precioAnterior)} → ${formatter.format(forma.precioUnitario)}.`
      );
    }
  });

  return cambios;
}

// Muestra al cliente los cambios que se hicieron en su carrito
function mostrarAvisoCarrito(cambios, tituloAviso = "Actualizamos tu pedido") {
  if (!cambios || cambios.length === 0) return;

  const aviso = document.createElement("div");
  aviso.className = "avisoCarrito";
  aviso.setAttribute("role", "status");

  const titulo = document.createElement("strong");
  titulo.textContent = tituloAviso;
  aviso.appendChild(titulo);

  const lista = document.createElement("ul");
  cambios.forEach(texto => {
    const item = document.createElement("li");
    item.textContent = texto;
    lista.appendChild(item);
  });
  aviso.appendChild(lista);

  const cerrar = document.createElement("span");
  cerrar.className = "avisoCarritoCerrar";
  cerrar.textContent = "Tocá para cerrar";
  aviso.appendChild(cerrar);

  const quitar = () => aviso.remove();
  aviso.addEventListener("click", quitar);
  setTimeout(quitar, 10000);

  document.body.appendChild(aviso);
}

// VACIAR CARRITO
function clearCart() {
  // Vaciar completamente el carrito
  Object.keys(cart).forEach(key => quitarDelCarrito(key));
  // Guardar carrito vacío
  saveCart();
   // Actualizar enlace de WhatsApp
  updateWhatsAppLink();
  // Actualizar footer, total y botón de WhatsApp

  updateCheckoutUI();
  // Volver a mostrar todos los productos con sus botones "Agregar"
  handleFilterPipeline();
}

function updateCheckoutUI() {

  const orderFooter = document.getElementById("orderFooter");
  const whatsappBtn = document.getElementById("whatsappBtn");
  const orderTotal = document.getElementById("orderTotal");

  let total = 0;

  Object.entries(cart).forEach(([id, qty]) => {
    const product = productoPorId(id);
    if (product) {
      total += precioUnitarioEnCarrito(product) * qty;
    }
  });

  orderTotal.textContent = formatter.format(roundToHundreds(total));
  orderTotal.classList.remove("pop");
  
  // Fuerza el reinicio de la animación
  void orderTotal.offsetWidth;
  orderTotal.classList.add("pop");

  const hasItems = Object.keys(cart).length > 0;

  orderFooter.classList.toggle("hidden", !hasItems);
  whatsappBtn.classList.toggle("hidden", hasItems);

  // Renglón rojo "Compra mínima" (js/carrito.js)
  if (typeof actualizarAvisoMinimo === "function") actualizarAvisoMinimo();

  // Aviso para el carrusel de ofertas (js/carrusel-ofertas.js)
  document.dispatchEvent(new Event("carritocambio"));
}

function updateWhatsAppLink() {
  const basePhone = CLIENTE.whatsapp.numero;
  // Los productos se listan en el mismo orden que el catálogo
  const cartEntries = Object.entries(cart)
    .filter(([_, qty]) => qty > 0)
    .sort(([idA], [idB]) =>
      (posicionEnCatalogo.get(idA) ?? Infinity) -
      (posicionEnCatalogo.get(idB) ?? Infinity)
    );

  if (cartEntries.length === 0) {
    const defaultText = encodeURIComponent(
      textoCliente(CLIENTE.mensajes.consulta)
    );

    globalWhatsAppUrl = `https://wa.me/${basePhone}?text=${defaultText}`;
    textoPedidoArmado = "";
    return;
  }
  let totalOrderPrice = 0;
  let totalItems = 0;

  let messageText = `${textoCliente(CLIENTE.mensajes.tituloPedido)}\n\n`;
  messageText += `${textoCliente(CLIENTE.mensajes.saludoPedido)}\n\n`;
  messageText += `${textoCliente(CLIENTE.mensajes.introPedido)}\n\n`;

  cartEntries.forEach(([productIdStr, quantity]) => {

    const product = productoPorId(productIdStr);

    if (product) {
      const forma = formaEnCarrito(product);
      const subtotal = forma.precioUnitario * quantity;

      totalOrderPrice += subtotal;
      totalItems += quantity;

      if (forma.oferta) {
        // "🔥 Oferta 27/10 · $699 (antes $899)"
        const cantidad = formaConMedida(forma) ? textoCantidadPedido(forma, quantity) : quantity;
        messageText += `• ${cantidad} × ${product.name} (${textoOfertaPedido(forma.oferta)})\n`;
      } else if (formaConMedida(forma)) {
        messageText += `• ${textoCantidadPedido(forma, quantity)} × ${product.name} (${formatter.format(forma.precioUnitario)} c/u)\n`;
      } else {
        messageText += `• ${quantity} × ${product.name} (${formatter.format(forma.precioUnitario)})\n`;
      }
    }

  });

  messageText += `\n────────────────────\n`;

  messageText += `💰 *TOTAL: ${formatter.format(
    roundToHundreds(totalOrderPrice)
  )} (${totalItems} ${
    totalItems === 1 ? "artículo" : "artículos"
  })*\n`;

  textoPedidoArmado = messageText;
  globalWhatsAppUrl =
    `https://wa.me/${basePhone}?text=${encodeURIComponent(messageText)}`;
    
}

// =========================================================
// CANDIDATOS DEL BUSCADOR
// La lista de candidatos (debajo del buscador) y las tarjetas
// de abajo salen de acá, así muestran lo mismo y en el mismo orden.
// Devuelve los grupos (hasta 10) y los Ids de sus productos en
// orden: grupo por grupo y, dentro de cada uno, el orden del catálogo.
// =========================================================

// Productos de un conjunto de Ids, en el orden del catálogo y con los
// sin stock al final de su categoría (así el cliente ve primero lo que
// puede comprar)
function productosEnOrden(conjuntoIds) {
  const lista = products.filter(product => conjuntoIds.has(String(product.Id)));
  return ordenarSinStockAlFinal(lista, true);
}

function calcularCandidatosBusqueda(query) {

  const normalizedQuery =
    typeof normalizeSearchValue === "function"
      ? normalizeSearchValue(query)
      : normalize(query);

  if (!normalizedQuery) {

    return { grupos: [], ids: [] };
  }

  if (
    typeof window.searchIndex === "undefined" ||
    !Array.isArray(window.searchIndex)
  ) {

    return { grupos: [], ids: [] };
  }

  const queryTerms =
    normalizedQuery
      .split(/\s+/)
      .map(term => term.trim())
      .filter(Boolean);

  if (!queryTerms.length) {

    return { grupos: [], ids: [] };
  }

  function getProductIdsForTerm(term) {

    const ids = new Set();

    window.searchIndex.forEach(entry => {

      if (
        !entry ||
        !entry.product ||
        !entry.tokens
      ) {
        return;
      }

      const matches =
        entry.tokens.some(token => {

          const normalizedToken =
            normalizeSearchValue(token);

          if (!normalizedToken) {
            return false;
          }

          return (
            normalizedToken.startsWith(term) ||
            normalizedToken.includes(term)
          );

        });

      if (matches) {

        ids.add(
          String(entry.productId)
        );

      }

    });

    return ids;
  }

  let allowedProductIds = null;

  if (queryTerms.length > 1) {

    for (
      let i = 0;
      i < queryTerms.length - 1;
      i++
    ) {

      const termIds =
        getProductIdsForTerm(
          queryTerms[i]
        );

      if (allowedProductIds === null) {

        allowedProductIds =
          new Set(termIds);

      } else {

        allowedProductIds =
          new Set(
            [...allowedProductIds].filter(
              productId =>
                termIds.has(productId)
            )
          );

      }

      if (!allowedProductIds.size) {

        return { grupos: [], ids: [] };
      }

    }

  }

  const candidateQuery =
    queryTerms[queryTerms.length - 1];

  const groups =
    new Map();

  window.searchIndex.forEach(entry => {

    if (
      !entry ||
      !entry.product ||
      !entry.tokens
    ) {
      return;
    }

    const productId =
      String(entry.productId);

    if (
      allowedProductIds &&
      !allowedProductIds.has(productId)
    ) {
      return;
    }

    entry.tokens.forEach(token => {

      const normalizedToken =
        normalizeSearchValue(token);

      if (!normalizedToken) {
        return;
      }

      if (
        !normalizedToken.includes(
          candidateQuery
        )
      ) {
        return;
      }

      let groupKey =
        normalizedToken;

      if (
        groupKey.length > 3 &&
        groupKey.endsWith("s")
      ) {

        groupKey =
          groupKey.slice(0, -1);

      }

      const displayName =
    queryTerms.length > 1
        ? queryTerms.slice(0, -1).join(" ") + " " + token
        : token;

      if (!groups.has(groupKey)) {

        groups.set(
          groupKey,
          {
            name: displayName,
            normalized: normalizedToken,
            products: new Set(),
            startsWith: true,
            exact:
              normalizedToken ===
              candidateQuery,
            length:
              normalizedToken.length
          }
        );

      }

      const group =
        groups.get(groupKey);

      group.products.add(productId);

    if (
        normalizedToken.length <
        group.length
    ) {

        group.name = displayName;
        group.normalized =
            normalizedToken;
        group.length =
            normalizedToken.length;

    }

    });

  });

  const finalGroups =
    Array.from(
      groups.values()
    );

  finalGroups.sort(
    (a, b) => {

      if (
        a.exact !==
        b.exact
      ) {

        return a.exact
          ? -1
          : 1;

      }

      if (
        a.products.size !==
        b.products.size
      ) {

        return (
          b.products.size -
          a.products.size
        );

      }

      if (
        a.length !==
        b.length
      ) {

        return (
          a.length -
          b.length
        );

      }

      return a.name.localeCompare(
        b.name,
        "es",
        {
          sensitivity: "base"
        }
      );

    }
  );

  const uniqueGroups = [];
  const signatures = new Set();

  finalGroups.forEach(group => {

    const signature =
      Array.from(
        group.products
      )
        .sort()
        .join("|");

    if (
      signatures.has(signature)
    ) {
      return;
    }

    signatures.add(signature);

    uniqueGroups.push(group);

  });

  const groupList =
    uniqueGroups.slice(
      0,
      10
    );

  if (!groupList.length) {

    return { grupos: [], ids: [] };
  }

  // Ids en orden: grupo por grupo; dentro de cada grupo, el orden del
  // catálogo con los productos sin stock al final de su categoría
  const ids = [];
  const vistos = new Set();
  groupList.forEach(group => {
    productosEnOrden(group.products).forEach(product => {
      const id = String(product.Id);
      if (!vistos.has(id)) { vistos.add(id); ids.push(id); }
    });
  });

  return { grupos: groupList, ids };
}

function renderSearchSuggestions(query) {

  const suggestions =
    document.querySelector("#searchSuggestions");

  if (!suggestions) return;

  const candidatos = calcularCandidatosBusqueda(query);
  const groupList = candidatos.grupos;

  if (!groupList.length) {
    suggestions.innerHTML = "";
    suggestions.hidden = true;
    return;
  }

  window.activeSearchCandidateGroups =
    groupList.map(group => ({
      name: group.name,
      productIds: new Set(
        group.products
      )
    }));

// =========================================================
// MOSTRAR
// =========================================================

// ---------------------------------------------------------
// OBTENER TODOS LOS PRODUCTOS DE LOS GRUPOS
//
// Se conserva el orden natural de "products".
// ---------------------------------------------------------

const allCandidateProductIds =
  new Set();

groupList.forEach(group => {

  group.products.forEach(productId => {

    allCandidateProductIds.add(
      String(productId)
    );

  });

});


// Mismo orden que las tarjetas de abajo (sin stock al final)
const candidateProducts =
  candidatos.ids.map(id => productoPorId(id)).filter(Boolean);


// ---------------------------------------------------------
// HASTA 10 PRODUCTOS EN TOTAL
//
// Mostramos directamente los productos individuales.
// ---------------------------------------------------------

if (
  candidateProducts.length <= 10
) {

  suggestions.innerHTML =
  candidateProducts.map(product => {

    return `
  <button
    type="button"
    class="searchSuggestionProduct ${product.inStock ? "" : "searchSuggestionProductDisabled"}"
    data-product-id="${idProducto(product)}"
    ${product.inStock ? "" : "disabled"}
  >

    <img
      class="searchSuggestionProductImage"
      src="${product.image || ""}"
      alt=""
    >

    <span class="searchSuggestionProductInfo">

      <span class="searchSuggestionProductName">
        ${product.name}
      </span>

      ${
        product.inStock
          ? ""
          : `<span class="searchSuggestionProductStatus">Próximamente</span>`
      }

    </span>

    <span class="searchSuggestionProductPrice">
      ${formatter.format(precioActual(product))}
    </span>

  </button>
    `;

  }).join("");


suggestions.querySelectorAll(
  ".searchSuggestionProduct"
).forEach(button => {

  button.onclick = (event) => {

    event.preventDefault();
    event.stopPropagation();


    const selectedProductId =
      String(
        button.dataset.productId
      );
      

suggestions.querySelectorAll(
  ".searchSuggestionItem"
).forEach(button => {

  button.addEventListener(
    "click",
    event => {

      event.preventDefault();

      const buttons =
        Array.from(
          suggestions.querySelectorAll(
            ".searchSuggestionItem"
          )
        );

      const selectedGroupIndex =
        buttons.indexOf(button);

      if (
        selectedGroupIndex < 0 ||
        !window.activeSearchCandidateGroups
      ) {
        return;
      }

      const selectedGroup =
        window.activeSearchCandidateGroups[
          selectedGroupIndex
        ];

      if (!selectedGroup) {
        return;
      }

      // -----------------------------------------------
      // OBTENER LOS PRODUCTOS DEL GRUPO
      // RESPETANDO EL ORDEN NATURAL
      // -----------------------------------------------

      const groupProducts =
        productosEnOrden(selectedGroup.productIds);

      // -----------------------------------------------
      // CERRAR DROPDOWN
      // -----------------------------------------------

      suggestions.innerHTML = "";
      suggestions.hidden = true;

      // -----------------------------------------------
      // MOSTRAR SOLAMENTE EL GRUPO SELECCIONADO
      // -----------------------------------------------

      renderProducts(
        groupProducts,
        searchInput.value
      );
      irArriba();   // resultados nuevos: se ven desde arriba

    }
  );

});


    // -------------------------------------------------------
    // BUSCAR EL GRUPO AL QUE PERTENECE EL PRODUCTO
    // -------------------------------------------------------

    const selectedGroup =
      window.activeSearchCandidateGroups
        ?.find(group =>
          group.productIds.has(
            selectedProductId
          )
        );


    if (!selectedGroup) {
      return;
    }


    // -------------------------------------------------------
    // OBTENER TODOS LOS PRODUCTOS DE ESE GRUPO
    // RESPETANDO EL ORDEN NATURAL DE products
    // -------------------------------------------------------

    const groupProducts =
      productosEnOrden(selectedGroup.productIds);


    const selectedProduct =
      products.find(product =>
        String(product.Id) ===
        selectedProductId
      );


    if (!selectedProduct) {
      return;
    }


    // -------------------------------------------------------
    // AGREGAR AL CARRITO
    // EXACTAMENTE COMO EL BOTÓN "AGREGAR"
    // -------------------------------------------------------

    const productIndex =
      idProducto(
        selectedProduct
      );

    if (selectedProduct.inStock) {

      agregarAlCarrito(
        selectedProduct,
        formaEnTarjeta(selectedProduct).numero
      );

      saveCart();
      updateWhatsAppLink();
      updateCheckoutUI();

    }


    // -------------------------------------------------------
    // CERRAR DROPDOWN
    // -------------------------------------------------------

    suggestions.hidden = true;
    suggestions.innerHTML = "";


    // -------------------------------------------------------
    // MOSTRAR SOLAMENTE EL GRUPO SELECCIONADO
    // -------------------------------------------------------

    renderProducts(
      groupProducts,
      searchInput.value
    );


    // -------------------------------------------------------
    // LLEVAR VISUALMENTE AL PRODUCTO SELECCIONADO
    // -------------------------------------------------------

    requestAnimationFrame(() => {

      const selectedCard =
        productGrid.querySelector(
          `.productCard[data-product-id="${productIndex}"]`
        );


      if (selectedCard) {

        selectedCard.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });

      }

    });

  };

});

suggestions.querySelectorAll(
  ".searchSuggestionProduct"
).forEach(button => {

  button.addEventListener(
    "click",
    event => {

      event.preventDefault();

      const selectedProductIndex =
        String(
          button.dataset.productId
        );

      const selectedProduct =
        productoPorId(selectedProductIndex);

      if (!selectedProduct) {
        return;
      }

      // Agregar al carrito
      agregarAlCarrito(
        selectedProduct,
        formaEnTarjeta(selectedProduct).numero
      );

      saveCart();
      updateWhatsAppLink();
      updateCheckoutUI();

      // Cerrar sugerencias
      suggestions.innerHTML = "";
      suggestions.hidden = true;

      // Buscar el grupo al que pertenece
      const selectedGroup =
        window.activeSearchCandidateGroups?.find(
          group =>
            group.productIds.has(
              String(selectedProduct.Id)
            )
        );

      if (!selectedGroup) {
        return;
      }

      // Productos pertenecientes al grupo
      const groupProducts =
        productosEnOrden(selectedGroup.productIds);

      // Mostrar solamente ese grupo
      renderProducts(
        groupProducts,
        searchInput.value
      );

      // Llevar la pantalla al producto seleccionado
      requestAnimationFrame(() => {

        const selectedCard =
          productGrid.querySelector(
            `[data-product-id="${selectedProductIndex}"]`
          );

        if (selectedCard) {

          selectedCard.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });

        }

      });

    }
  );

});
  suggestions.hidden = false;
  suggestions.hidden = false;

  return;
}


// ---------------------------------------------------------
// MÁS DE 10 PRODUCTOS
//
// Si existe un único grupo, mostramos sus primeros
// 10 productos individuales.
// ---------------------------------------------------------

if (
  groupList.length === 1
) {

  const groupProductIds =
    groupList[0].products;


  const productsForGroup =
    productosEnOrden(groupProductIds)
      .slice(0, 10);


  suggestions.innerHTML =
    productsForGroup.map(product => {

      return `
    <button
      type="button"
      class="searchSuggestionProduct ${product.inStock ? "" : "searchSuggestionProductDisabled"}"
      data-product-id="${idProducto(product)}"
      ${product.inStock ? "" : "disabled"}
    >

      <img
        class="searchSuggestionProductImage"
        src="${product.image || ""}"
        alt=""
      >

      <span class="searchSuggestionProductInfo">

        <span class="searchSuggestionProductName">
          ${product.name}
        </span>

        ${
          product.inStock
            ? ""
            : `<span class="searchSuggestionProductStatus">Próximamente</span>`
        }

      </span>

      <span class="searchSuggestionProductPrice">
        ${formatter.format(precioActual(product))}
      </span>

    </button>
      `;

    }).join("");
    

  suggestions.hidden = false;
}


// ---------------------------------------------------------
// MÁS DE 10 PRODUCTOS Y VARIOS GRUPOS
//
// En este caso seguimos mostrando los grupos.
// ---------------------------------------------------------

suggestions.innerHTML =
  groupList.map((group, index) => {

    return `
      <button
        type="button"
        class="searchSuggestionItem"
        data-group-index="${index}"
      >
        <span class="searchSuggestionName">
          ${group.name}
        </span>

        <span class="searchSuggestionCount">
          ${group.products.size}
        </span>
      </button>
    `;

  }).join("");


// =========================================================
// CLIC SOBRE UN GRUPO
// =========================================================

suggestions.querySelectorAll(
  ".searchSuggestionItem"
).forEach(button => {

  button.addEventListener(
    "click",
    event => {

      event.preventDefault();
      event.stopPropagation();

      const groupIndex =
        Number(
          button.dataset.groupIndex
        );

      const selectedGroup =
        groupList[groupIndex];

      if (!selectedGroup) {
        return;
      }


      // -----------------------------------------------------
      // PRODUCTOS DEL GRUPO
      //
      // Al recorrer "products" conservamos el orden natural
      // del catálogo.
      // -----------------------------------------------------

      const groupProducts =
        productosEnOrden(selectedGroup.products);


      // -----------------------------------------------------
      // CERRAR DROPDOWN
      // -----------------------------------------------------

      suggestions.innerHTML = "";
      suggestions.hidden = true;


      // -----------------------------------------------------
      // INFORMACIÓN SUPERIOR
      // -----------------------------------------------------

      resultCount.textContent =
        `${groupProducts.length} ${
          groupProducts.length === 1
            ? "producto"
            : "productos"
        }`;

      activeQuery.textContent =
        `Resultados: "${selectedGroup.name}"`;


      // -----------------------------------------------------
      // RENDERIZAR SOLAMENTE EL GRUPO
      // -----------------------------------------------------

      renderProducts(
        groupProducts,
        selectedGroup.name
      );
      irArriba();   // resultados nuevos: se ven desde arriba

    }
  );

});


suggestions.hidden = false;

}

function setupAppEvents() {
  searchInput.addEventListener("input", () => {
    updateFilterOptions(true);
    renderSearchSuggestions(searchInput.value);
    handleFilterPipeline();
    irArriba();
  });

  document.querySelectorAll(".filterGroup").forEach(group => {
    const triggerBtn = group.querySelector(".customSelectTrigger");
    const dropdown = group.querySelector(".optionsDropdown");

    triggerBtn.onclick = (e) => {
      e.stopPropagation();
      const currentlyHidden = dropdown.hidden;
      
      document.querySelectorAll(".optionsDropdown").forEach(d => d.hidden = true);
      document.querySelectorAll(".customSelectTrigger").forEach(b => b.classList.remove("is-active"));

      if (currentlyHidden) {
        dropdown.hidden = false;
        triggerBtn.classList.add("is-active");
      }
    };
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".optionsDropdown").forEach(d => d.hidden = true);
    document.querySelectorAll(".customSelectTrigger").forEach(b => b.classList.remove("is-active"));
  });

  if (filterToggleBtn) filterToggleBtn.onclick = () => filterModal.hidden = false;
  if (closeFilterBtn) closeFilterBtn.onclick = () => filterModal.hidden = true;

  clearFiltersBtn.onclick = () => {
    searchInput.value = "";
    activeFilters = filtrosVacios();
    updateFilterOptions(false);
    handleFilterPipeline();
    irArriba();
    filterModal.hidden = true;
  };

  if (whatsappElement) {
    whatsappElement.removeAttribute("href"); 
    whatsappElement.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (globalWhatsAppUrl !== "") {
        window.open(globalWhatsAppUrl, "_blank", "noopener,noreferrer");
      }
    };
  }
}

window.onload = () => {

  if (searchInput) searchInput.value = "";

  activeFilters = filtrosVacios();

  updateFilterOptions(false);

  handleFilterPipeline();

  setupAppEvents();

  updateWhatsAppLink();

  mostrarAvisoCarrito(cambiosCarrito);
  cambiosCarrito = [];

};

// El botón "Ver pedido" del pie abre la pantalla del pedido (js/carrito.js),
// que es la que envía por WhatsApp y controla la compra mínima.

// MANEJA DE LA X DE BORRADO DEL SEARCHINPUT

const clearSearchBtn = document.getElementById("clearSearchBtn");

searchInput.addEventListener("input", () => {
  clearSearchBtn.classList.toggle(
    "hidden",
    searchInput.value.trim() === ""
  );
});

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  searchInput.focus();
});

