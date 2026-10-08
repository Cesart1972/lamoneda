/* =========================================================
   APP.JS
   ---------------------------------------------------------
   Punto de entrada principal de la PWA.
   ========================================================= */

   document.addEventListener("DOMContentLoaded", async () => {

    // 1. Aplicar configuración de la empresa
    applyCompanyConfig();
   });



/* =========================================================
   CONFIGURACIÓN DE LA EMPRESA
   ========================================================= */

   function applyCompanyConfig() {

    // Empresa
    document.title = EMPRESA.nombre;

    document.getElementById("description").content =
        EMPRESA.descripcion;

    document.getElementById("favicon").href =
        EMPRESA.favicon;

    document.getElementById("logoEmpresa").src =
        EMPRESA.logo;
    
    // Título del catálogo
        document.getElementById("tituloCatalogo").textContent =
        EMPRESA.tituloCatalogo;
   }

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

const PWA_LAST_REFRESH_KEY =
  "pwaLastRefreshTime";

const PWA_REFRESH_INTERVAL =
  60 * 60 * 1000;

const formatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0
});

// Estado inicial limpio de filtros cruzados
let activeFilters = {
  category: "ALL",
  brand: "ALL",
  comestibles: "ALL",
  limpieza: "ALL"
};

// Estado global del carrito de compras (id_producto: cantidad)
const cart = {};

// Variable global interna para guardar la URL de WhatsApp calculada en tiempo real
let globalWhatsAppUrl = "";

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

// Elementos de la estructura interna del modal
const filterCategory = document.querySelector("#filterCategory");
const filterBrand = document.querySelector("#filterBrand");
const filterComestibles = document.querySelector("#filterComestibles");
const filterLimpieza = document.querySelector("#filterLimpieza");

// =========================================================
// ACTUALIZACIÓN AUTOMÁTICA DEL CATÁLOGO
// =========================================================

const PWA_REFRESH_DATE_KEY =
  "pwaLastRefreshDate";

const PWA_SCROLL_REFRESH_KEY =
  "pwaScrollRefreshDone";

const PWA_SEARCH_REFRESH_KEY =
  "pwaSearchRefreshDone";


function getTodayKey() {

  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function refreshPWA(reason) {

  markPWARefresh();

  if (reason === "entry") {

    localStorage.setItem(
      PWA_REFRESH_DATE_KEY,
      getTodayKey()
    );

  }

  if (reason === "scroll") {

    sessionStorage.setItem(
      PWA_SCROLL_REFRESH_KEY,
      "1"
    );

  }

  if (reason === "search") {

    sessionStorage.setItem(
      PWA_SEARCH_REFRESH_KEY,
      "1"
    );

  }

  location.reload();
}

function checkDailyEntryRefresh() {

  const today =
    getTodayKey();

  const lastRefreshDate =
    localStorage.getItem(
      PWA_REFRESH_DATE_KEY
    );

  if (
    lastRefreshDate !== today
  ) {

    refreshPWA("entry");

    return true;
  }

  return false;
}

// Generador de imágenes vectoriales SVG por categoría (Fallback)
function categoryImage(category) {
  const categoryStyles = {
    "GASEOSAS": ["Gaseosas", "#dc2626", "#fee2e2"],
    "JUGOS": ["Jugos", "#ea580c", "#ffedd5"],
    "AGUAS Y SODAS": ["Agua", "#0284c7", "#e0f2fe"],
    "SNACKS": ["Snacks", "#ca8a04", "#fef9c3"],
    "CERVEZAS": ["Cervezas", "#b45309", "#fef3c7"],
    "VINOS Y ESPUMANTES": ["Vinos", "#9f1239", "#ffe4e6"],
    "LICORES": ["Licores", "#581c87", "#f3e8ff"],
    "VARIOS": ["Varios", "#0f766e", "#ccfbf1"]
  };
  const [label, color, background] = categoryStyles[category] || ["Producto", "#334155", "#e2e8f0"];
  const svg = `<svg xmlns="http://w3.org" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="${background}"/><rect x="130" y="72" width="380" height="276" rx="28" fill="#fff" opacity=".92"/><rect x="170" y="118" width="300" height="178" rx="22" fill="${color}"/><circle cx="218" cy="164" r="34" fill="#fff" opacity=".22"/><path d="M170 258c66-38 115-36 169 0s87 39 131 4v34H170z" fill="#fff" opacity=".18"/><text x="320" y="205" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="800" fill="#fff">${category}</text><text x="320" y="244" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#fff" opacity=".9">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// Normalización de texto para búsquedas libres
function normalize(value) {
  if (!value) return "";
  return value.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function productMatches(product, query) {
  const searchableText = `${product.brand || ''} ${product.category || ''} ${product.name || ''} ${product.keywords || ''} ${product.comestibles || ''} ${product.limpieza || ''}`;
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

  const pools = { category: new Set(), brand: new Set(), comestibles: new Set(), limpieza: new Set() };

  products.forEach(product => {
    const matchCat = (activeFilters.category === "ALL" || product.category === activeFilters.category);
    const matchBrand = (activeFilters.brand === "ALL" || product.brand === activeFilters.brand);
    const matchCom = (activeFilters.comestibles === "ALL" || product.comestibles === activeFilters.comestibles);
    const matchLim = (activeFilters.limpieza === "ALL" || product.limpieza === activeFilters.limpieza);

    const valid = (val) => val && val.toString().trim().toUpperCase() !== "NO" && val.toString().trim() !== "";

    if (matchBrand && matchCom && matchLim && valid(product.category)) pools.category.add(product.category.trim());
    if (matchCat && matchCom && matchLim && valid(product.brand)) pools.brand.add(product.brand.trim());
    if (matchCat && matchBrand && matchLim && valid(product.comestibles)) pools.comestibles.add(product.comestibles.trim());
    if (matchCat && matchBrand && matchCom && valid(product.limpieza)) pools.limpieza.add(product.limpieza.trim());
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

    const placeholderNames = { category: "Categorías", brand: "Marcas", comestibles: "Comestibles", limpieza: "Limpieza" };
    triggerBtn.textContent = activeFilters[key] === "ALL" ? placeholderNames[key] : activeFilters[key];

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

  const adminMode = query === "quiebre";

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

  // =====================================================
  // FILTRADO
  // =====================================================

  const filteredProducts = products.filter(product => {

    const matchesSearch = adminMode
      ? !product.inStock
      : (
          !query ||
          (
            smartResultIds &&
            smartResultIds.has(String(product.Id))
          )
        );

    const matchesCat =
      activeFilters.category === "ALL" ||
      product.category === activeFilters.category;

    const matchesBrand =
      activeFilters.brand === "ALL" ||
      product.brand === activeFilters.brand;

    const matchesCom =
      activeFilters.comestibles === "ALL" ||
      product.comestibles === activeFilters.comestibles;

    const matchesLim =
      activeFilters.limpieza === "ALL" ||
      product.limpieza === activeFilters.limpieza;

    return (
      matchesSearch &&
      matchesCat &&
      matchesBrand &&
      matchesCom &&
      matchesLim
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

    } else {

        filteredProducts.sort((a, b) => {

            if (a.inStock === b.inStock) return 0;

            return a.inStock ? -1 : 1;

        });

    }

  // =====================================================
  // INFORMACIÓN SUPERIOR
  // =====================================================

  resultCount.textContent =
    `${filteredProducts.length} ${
      filteredProducts.length === 1
        ? "producto"
        : "productos"
    }`;

  let label = "Mostrando toda la lista";

  const activeLabels = [];

  if (query) {
    activeLabels.push(
      `"${searchInput.value.trim()}"`
    );
  }

  if (activeFilters.category !== "ALL") {
    activeLabels.push(activeFilters.category);
  }

  if (activeFilters.brand !== "ALL") {
    activeLabels.push(activeFilters.brand);
  }

  if (activeFilters.comestibles !== "ALL") {
    activeLabels.push(activeFilters.comestibles);
  }

  if (activeFilters.limpieza !== "ALL") {
    activeLabels.push(activeFilters.limpieza);
  }

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

  renderProducts(filteredProducts, query);
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

  return true;
}


function renderProducts(items, query = "") {
  productGrid.replaceChildren();
  const fragment = document.createDocumentFragment();

  if (items.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  items.forEach((product) => {
    const cardClone = template.content.cloneNode(true);
    const article = cardClone.querySelector(".productCard");
    const image = cardClone.querySelector(".productImage");
    const name = cardClone.querySelector(".name");
    const price = cardClone.querySelector(".price");
    
    const productId = products.indexOf(product);
    article.dataset.productId = String(productId);

    if (product.destacado === true) {
      article.classList.add("is-featured");
    }

    if (product.ribbon && product.ribbon.trim() !== "" && product.ribbon.trim().toUpperCase() !== "NO") {
      const ribbonContainer = cardClone.querySelector(".ribbonContainer");
      if (ribbonContainer) {
        ribbonContainer.hidden = false;
        cardClone.querySelector(".ribbonText").textContent = product.ribbon;
      }
    } else {
      const ribbonContainer = cardClone.querySelector(".ribbonContainer");
      if (ribbonContainer) ribbonContainer.hidden = true;
    }

    image.src = product.image || categoryImage(product.category);
    image.alt = product.name;
    name.textContent = product.name;
    price.textContent = formatter.format(product.price);

    const addBtn = cardClone.querySelector(".addBtn");
    const stepUnits = product.step || 1;
    
    if (product.inStock) {
      if (stepUnits > 1) {
        addBtn.textContent = `Agregar (x${stepUnits})`;
      } else {
        addBtn.textContent = "Agregar";
      }
    } else {
      addBtn.textContent = "Próximamente";
      addBtn.classList.add("outOfStock");
      addBtn.disabled = true;
    }

    updateCardControls(article, product, true);
   
    const plusBtn = cardClone.querySelector(".plusBtn");
    const minusBtn = cardClone.querySelector(".minusBtn");

      addBtn.onclick = () => {
        cart[productId] = stepUnits;
        saveCart();
        updateCardControls(article, product, false);
        updateWhatsAppLink();
        updateCheckoutUI();
      };
    
      plusBtn.onclick = () => {
        const step = product.step || 1;
        cart[productId] = (cart[productId] || 0) + step;
        saveCart();
        updateCardControls(article, product, true);
        updateWhatsAppLink();
        updateCheckoutUI();
      };
    
      minusBtn.onclick = () => {
        const step = product.step || 1;
        if (cart[productId] > 0) {
          cart[productId] -= step;
          if (cart[productId] <= 0) {
            delete cart[productId];
          }
        }
        saveCart();
        updateCardControls(article, product, false);
        updateWhatsAppLink();
        updateCheckoutUI();
      };
    
  

    scrollObserver.observe(article);
    fragment.appendChild(cardClone);
  });

  productGrid.appendChild(fragment);
}

function updateCardControls(article, product, instant = false) {
  const addBtn = article.querySelector(".addBtn");
  const counterControls = article.querySelector(".counterControls");
  const quantityValue = article.querySelector(".quantityValue");
  
  if (!product.inStock) {
    addBtn.classList.remove("is-hidden");
    counterControls.classList.add("is-hidden");
    return;
  }
  
  const productId = products.indexOf(product); 
  const currentQty = cart[productId] || 0;

  if (currentQty > 0) {
    quantityValue.textContent = currentQty;
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

function saveCart() {
  if (Object.keys(cart).length === 0) {
    localStorage.removeItem("cart");
  } else {
    localStorage.setItem("cart", JSON.stringify(cart));
  }
  function roundToHundreds(value) {
    return Math.round(value / 100) * 100;
  }
}

function loadCart() {
  const savedCart = localStorage.getItem("cart");

  if (savedCart) {
    try {
      Object.assign(cart, JSON.parse(savedCart));
    } catch (e) {
      localStorage.removeItem("cart");
    }
  }
  function roundToHundreds(value) {
    return Math.round(value / 100) * 100;
  }
}

// VACIAR CARRITO
function clearCart() {
  // Vaciar completamente el carrito
  Object.keys(cart).forEach(key => delete cart[key]);
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
    const product = products[parseInt(id, 10)];
    if (product) {
      total += product.price * qty;
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
}

function updateWhatsAppLink() {
  const basePhone = "5492346336888";
  const cartEntries = Object.entries(cart).filter(([_, qty]) => qty > 0);

  if (cartEntries.length === 0) {
    const defaultText = encodeURIComponent(
      "¡Hola! Estuve viendo tu lista de precios y quería hacerte una consulta."
    );

    globalWhatsAppUrl = `https://wa.me/${basePhone}?text=${defaultText}`;
    return;
  }
  let totalOrderPrice = 0;
  let totalItems = 0;

  let messageText = `🛒 *PEDIDO*\n\n`;
  messageText += `Hola César.\n\n`;
  messageText += `Quiero realizar el siguiente pedido:\n\n`;

  cartEntries.forEach(([productIdStr, quantity]) => {

    const productIndex = parseInt(productIdStr, 10);
    const product = products[productIndex];

    if (product) {
      const subtotal = product.price * quantity;

      totalOrderPrice += subtotal;
      totalItems += quantity;

      messageText += `• ${quantity} × ${product.name} (${formatter.format(product.price)})\n`;
    }

  });

  messageText += `\n────────────────────\n`;

  messageText += `💰 *TOTAL: ${formatter.format(
    roundToHundreds(totalOrderPrice)
  )} (${totalItems} ${
    totalItems === 1 ? "artículo" : "artículos"
  })*\n`;

  globalWhatsAppUrl =
    `https://wa.me/${basePhone}?text=${encodeURIComponent(messageText)}`;
    
}

function renderSearchSuggestions(query) {

  const suggestions =
    document.querySelector("#searchSuggestions");

  if (!suggestions) return;

  const normalizedQuery =
    typeof normalizeSearchValue === "function"
      ? normalizeSearchValue(query)
      : normalize(query);

  if (!normalizedQuery) {

    suggestions.innerHTML = "";
    suggestions.hidden = true;

    return;
  }

  if (
    typeof window.searchIndex === "undefined" ||
    !Array.isArray(window.searchIndex)
  ) {

    suggestions.innerHTML = "";
    suggestions.hidden = true;

    return;
  }

  const queryTerms =
    normalizedQuery
      .split(/\s+/)
      .map(term => term.trim())
      .filter(Boolean);

  if (!queryTerms.length) {

    suggestions.innerHTML = "";
    suggestions.hidden = true;

    return;
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

        suggestions.innerHTML = "";
        suggestions.hidden = true;

        return;
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


const candidateProducts =
  products.filter(product =>
    allCandidateProductIds.has(
      String(product.Id)
    )
  );


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
    data-product-id="${products.indexOf(product)}"
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
      ${formatter.format(product.price)}
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
        products.filter(product =>
          selectedGroup.productIds.has(
            String(product.Id)
          )
        );

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
      products.filter(product =>
        selectedGroup.productIds.has(
          String(product.Id)
        )
      );


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
      products.indexOf(
        selectedProduct
      );

    const stepUnits =
      selectedProduct.step || 1;


    if (selectedProduct.inStock) {

      cart[productIndex] =
        stepUnits;

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
        Number(
          button.dataset.productId
        );

      const selectedProduct =
        products[selectedProductIndex];

      if (!selectedProduct) {
        return;
      }

      // Producto seleccionado
      const stepUnits =
        selectedProduct.step || 1;

      // Agregar al carrito
      cart[selectedProductIndex] =
        stepUnits;

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
        products.filter(product =>
          selectedGroup.productIds.has(
            String(product.Id)
          )
        );

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
    products
      .filter(product =>
        groupProductIds.has(
          String(product.Id)
        )
      )
      .slice(0, 10);


  suggestions.innerHTML =
    productsForGroup.map(product => {

      return `
    <button
      type="button"
      class="searchSuggestionProduct ${product.inStock ? "" : "searchSuggestionProductDisabled"}"
      data-product-id="${products.indexOf(product)}"
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
        ${formatter.format(product.price)}
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
        products.filter(product =>
          selectedGroup.products.has(
            String(product.Id)
          )
        );


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

    }
  );

});


suggestions.hidden = false;

}

function setupAppEvents() {
  if (searchInput.value.trim() !== "" && !sessionStorage.getItem(PWA_SEARCH_REFRESH_KEY))
    { sessionStorage.setItem( PWA_SEARCH_REFRESH_KEY, "1" );
    location.reload();
    return;}

    searchInput.addEventListener("input", () => {if (
  searchInput.value.trim() !== "" &&
  !sessionStorage.getItem(
    PWA_SEARCH_REFRESH_KEY
  )
) {

    sessionStorage.setItem(
      PWA_SEARCH_REFRESH_KEY,
      "1"
    );

    if (
      !wasPWARecentlyRefreshed()
    ) {

      refreshPWA("search");
      return;

    }
}
 updateFilterOptions(true); renderSearchSuggestions(searchInput.value); handleFilterPipeline(); window.scrollTo(0, 0);
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
    activeFilters = { category: "ALL", brand: "ALL", comestibles: "ALL", limpieza: "ALL" };
    updateFilterOptions(false);
    handleFilterPipeline();
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

  // Si el último ingreso fue otro día,
  // refresca la PWA antes de continuar.
  if (checkDailyEntryRefresh()) {
    return;
  }

  if (searchInput) searchInput.value = "";

  activeFilters = {
    category: "ALL",
    brand: "ALL",
    comestibles: "ALL",
    limpieza: "ALL"
  };

  updateFilterOptions(false);

  handleFilterPipeline();

  setupAppEvents();

  updateWhatsAppLink();

};

function handleFirstUserScroll() {

  if (
    sessionStorage.getItem(
      PWA_SCROLL_REFRESH_KEY
    )
  ) {
    return;
  }

  sessionStorage.setItem(
    PWA_SCROLL_REFRESH_KEY,
    "1"
  );

  if (
    wasPWARecentlyRefreshed()
  ) {
    return;
  }

  refreshPWA("scroll");
}


window.addEventListener(
  "wheel",
  handleFirstUserScroll,
  {
    passive: true
  }
);


window.addEventListener(
  "touchmove",
  handleFirstUserScroll,
  {
    passive: true
  }
);

function handleFirstUserSearch() {

  if (
    sessionStorage.getItem(
      PWA_SEARCH_REFRESH_KEY
    )
  ) {
    return false;
  }

  sessionStorage.setItem(
    PWA_SEARCH_REFRESH_KEY,
    "1"
  );

  location.reload();

  return true;
}

checkoutBtn.addEventListener("click", () => {

  // Genera el mensaje incluyendo los clicks
  updateWhatsAppLink();

  // Envía el pedido
  window.open(globalWhatsAppUrl, "_blank", "noopener,noreferrer");

  // Vacía el carrito y restaura la interfaz
  clearCart();
});

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


function markPWARefresh() {

  localStorage.setItem(
    PWA_LAST_REFRESH_KEY,
    String(Date.now())
  );

}


function wasPWARecentlyRefreshed() {

  const lastRefresh =
    Number(
      localStorage.getItem(
        PWA_LAST_REFRESH_KEY
      )
    );

  if (!lastRefresh) {
    return false;
  }

  return (
    Date.now() - lastRefresh <
    PWA_REFRESH_INTERVAL
  );
}

