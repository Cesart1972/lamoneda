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

// Solo los productos que se pueden comprar (para el buscador, filtros, etc.)
const productosVendibles = products.filter(esProducto);
