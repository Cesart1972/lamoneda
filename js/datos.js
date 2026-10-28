/* =========================================================
   DATOS.JS
   ---------------------------------------------------------
   Ayudas para leer products-data.js. Se carga antes que el
   buscador y que el resto del programa.

   1. NOMBRES DE CAMPOS
      Algunos campos se renombraron. Mientras products-data.js
      tenga los nombres viejos, se siguen leyendo igual:

        Nombre nuevo              Nombre viejo
        PresentacionVenta    ←    medida1
        PrecioPorVolumen     ←    precio2
        PresentacionPorVolumen ←  medida2
        UnidadesPorVolumen   ←    unidades2
        MinimoPorVolumen     ←    minimo2

   2. TIPO DE MUESTRA (campo TipoMuestra)
      ¿De qué forma se muestra el artículo en el catálogo?
        "producto"  → tarjeta normal con precio y "Agregar" (vacío = producto)
        "poster"    → solo la imagen; al tocarla muestra esa línea de productos
        "separador" → título de sección (el texto sale del campo name)

   3. ETIQUETAS y 4. CHIPS: ver más abajo.
   ========================================================= */


// Lee un campo por su nombre nuevo; si está vacío, por el viejo
function campoProducto(product, nombreNuevo, nombreViejo) {
  const valor = product?.[nombreNuevo];
  if (valor !== undefined && valor !== null && valor !== "") return valor;
  return product?.[nombreViejo];
}

function tipoMuestra(product) {
  const tipo = String(product?.TipoMuestra ?? "").trim().toLowerCase();
  if (tipo === "poster" || tipo === "afiche") return "poster";
  if (tipo === "separador") return "separador";
  return "producto";
}

// ¿Es un producto que se puede comprar? (no poster ni separador)
function esProducto(product) {
  return tipoMuestra(product) === "producto";
}

/* 3. ETIQUETAS (chips)
      En keywords, las palabras que empiezan con # son etiquetas:
        "Marolio fideos #sintacc #ninos"
      Se sacan de keywords (no cuentan para el buscador ni para los
      posters) y quedan en product.etiquetas = ["sintacc", "ninos"].
      "#hoy:2026-10-20" vale solo ese día. */

function normalizarEtiqueta(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^#/, "")
    .trim();
}

products.forEach(product => {
  const palabras = String(product.keywords || "").split(/\s+/);
  product.etiquetas = palabras
    .filter(palabra => palabra.startsWith("#") && palabra.length > 1)
    .map(normalizarEtiqueta);
  product.keywords = palabras
    .filter(palabra => !palabra.startsWith("#"))
    .join(" ")
    .trim();
});

// Fecha de hoy como "2026-10-20" (hora del celular)
function fechaDeHoy() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

function tieneEtiqueta(product, etiqueta) {
  if (!etiqueta) return false;
  return (product.etiquetas || []).some(propia => {
    if (propia === etiqueta) return true;
    const [nombre, fecha] = propia.split(":");
    return nombre === etiqueta && fecha === fechaDeHoy();
  });
}


/* 4. CHIPS (cliente/config.js → chips)
      Un producto entra en un chip si tiene su etiqueta (#clave),
      si su cinta (ribbon) es una de las "cintas" del chip,
      si su categoría es una de las "categorias" del chip
      o, con oferta: "hoy" (Solo x hoy vigente), "rebaja" (rebaja
      permanente) o "todas", si tiene esa oferta (js/ofertas.js). */

function textoComparable(texto) {
  return normalizarEtiqueta(texto).replace(/[^a-z0-9]/g, "");
}

const CHIPS = (CLIENTE.chips || [])
  .filter(chip => chip && chip.clave && chip.texto)
  .map(chip => ({
    ...chip,
    etiqueta: normalizarEtiqueta(chip.etiqueta || chip.clave),
    cintasComparables: (chip.cintas || []).map(textoComparable),
    categoriasComparables: (chip.categorias || []).map(textoComparable)
  }));

function porEtiqueta(product, chip) {
  return tieneEtiqueta(product, chip.etiqueta);
}

function productoEnChip(product, chip) {
  if (!chip) return true;
  // Favoritos: los que el cliente marcó con el corazón o ya compró (js/favoritos.js)
  if (chip.especial === "favoritos") {
    return typeof esFavorito === "function" && esFavorito(product);
  }
  if (chip.oferta && typeof ofertaDelProducto === "function") {
    const oferta = ofertaDelProducto(product);
    if (oferta && (chip.oferta === "todas" || chip.oferta === oferta.tipo)) return true;
  }
  if (porEtiqueta(product, chip)) return true;
  const cinta = textoComparable(product.ribbon);
  if (cinta && chip.cintasComparables.includes(cinta)) return true;
  const categoria = textoComparable(product.category);
  return Boolean(categoria) && chip.categoriasComparables.includes(categoria);
}

// Varios chips marcados: el producto tiene que estar en todos
// (ej. Niños + Sin TACC, Ofertas + Limpieza)
function productoEnChips(product, chips) {
  return (chips || []).every(chip => productoEnChip(product, chip));
}

// Chips que se muestran como íconos en la tarjeta (solo los de etiqueta;
// los de cinta y categoría no, porque ya se ven en la cinta o la barra)
function chipsDeLaTarjeta(product) {
  return CHIPS.filter(chip => chip.icono && porEtiqueta(product, chip));
}

// Solo los productos que se pueden comprar (para el buscador, filtros, etc.)
const productosVendibles = products.filter(esProducto);
