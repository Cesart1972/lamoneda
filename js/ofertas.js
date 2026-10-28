/* =========================================================
   OFERTAS.JS
   ---------------------------------------------------------
   Ofertas "Solo x hoy" y rebajas permanentes.
   No dibuja nada: solo decide qué oferta tiene cada producto.
   Se carga después de js/datos.js y antes de js/formas-compra.js.

   Columnas de products-data.js:
     FechaOferta   columna "web" del Excel ("2026-10-27" o vacía)
     PrecioOferta  precio de oferta por unidad (vacío = sin oferta)

   Reglas:
     PrecioOferta vacío                → precio normal
     PrecioOferta + FechaOferta = hoy  → "Solo x hoy"
     PrecioOferta + otra fecha         → se ignora (se carga la semana por adelantado)
     PrecioOferta + FechaOferta vacía  → rebaja permanente

   La oferta tiene que ser menor que price e igual o menor que
   PrecioPorVolumen (si lo tiene). Si no, se ignora y se avisa en la
   consola. Se vende con el step de price y sin el precio por volumen.
   La fecha es la del celular del cliente. A la medianoche la oferta
   se apaga sola (ver programarMedianoche).
   ========================================================= */

const cacheOfertas = new Map();
// Productos con oferta mal cargada (para no avisar dos veces)
const ofertasAvisadas = new Set();

// Fecha del día en que se calcularon las ofertas
let diaDeLasOfertas = fechaDeHoy();

function textoFechaOferta(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";
  // "2026-10-27" (lo que arma la fórmula del Excel)
  let partes = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (partes) return `${partes[1]}-${partes[2].padStart(2, "0")}-${partes[3].padStart(2, "0")}`;
  // "27/10/2026" (por si se escribe a mano)
  partes = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (partes) return `${partes[3]}-${partes[2].padStart(2, "0")}-${partes[1].padStart(2, "0")}`;
  return "invalida";
}

/* Oferta del producto, o null:
     tipo     "hoy" o "rebaja"
     precio   precio de oferta por unidad
     antes    price (el precio normal, se muestra tachado)
     ahorro   % de ahorro (redondeado)
     fecha    "2026-10-27" (solo "hoy") */
function ofertaDelProducto(product) {
  if (!product) return null;
  if (cacheOfertas.has(product)) return cacheOfertas.get(product);

  let oferta = null;
  const precio = Number(product.PrecioOferta);
  const antes = Number(product.price) || 0;

  if (product.PrecioOferta !== null && product.PrecioOferta !== undefined &&
      product.PrecioOferta !== "" && Number.isFinite(precio) && precio > 0) {
    const fecha = textoFechaOferta(product.FechaOferta);
    const volumen = numeroPositivo(campoProducto(product, "PrecioPorVolumen", "precio2"));
    let error = "";

    if (fecha === "invalida") error = `la FechaOferta "${product.FechaOferta}" no se entiende`;
    else if (!(precio < antes)) error = `PrecioOferta (${precio}) tiene que ser menor que price (${antes})`;
    else if (volumen && precio > volumen) error = `PrecioOferta (${precio}) tiene que ser igual o menor que PrecioPorVolumen (${volumen})`;

    if (error) {
      if (!ofertasAvisadas.has(product.Id)) {
        ofertasAvisadas.add(product.Id);
        console.warn(`Producto ${product.Id} (${product.name}): ${error}. La oferta no se aplica.`);
      }
    } else if (!fecha || fecha === diaDeLasOfertas) {
      oferta = {
        tipo: fecha ? "hoy" : "rebaja",
        precio,
        antes,
        ahorro: Math.round((1 - precio / antes) * 100),
        fecha
      };
    }
  }

  cacheOfertas.set(product, oferta);
  return oferta;
}

function ofertaDeHoy(product) {
  const oferta = ofertaDelProducto(product);
  return oferta && oferta.tipo === "hoy" ? oferta : null;
}

// Precio por unidad que se cobra hoy (con la oferta, si tiene)
function precioActual(product) {
  const oferta = ofertaDelProducto(product);
  return oferta ? oferta.precio : (Number(product.price) || 0);
}

// Oferta común a todas las variedades de un poster (mismo tipo y mismo
// precio en todas). Si alguna no la tiene o es distinta, null.
function ofertaComunDeVariedades(variedades) {
  if (!variedades || variedades.length === 0) return null;
  let comun = null;
  for (const product of variedades) {
    const oferta = ofertaDelProducto(product);
    if (!oferta) return null;
    if (comun === null) comun = oferta;
    else if (comun.tipo !== oferta.tipo || comun.precio !== oferta.precio || comun.antes !== oferta.antes) return null;
  }
  return comun;
}

// "27/10"
function fechaCortaOferta(fecha) {
  const [, mes, dia] = String(fecha || "").split("-");
  return dia && mes ? `${dia}/${mes}` : "";
}

// Texto del ticket de WhatsApp: "🔥 Oferta 27/10 · $699 (antes $899)"
function textoOfertaPedido(oferta) {
  if (!oferta) return "";
  const etiqueta = oferta.tipo === "hoy"
    ? `🔥 Oferta ${fechaCortaOferta(oferta.fecha)}`
    : "🏷️ Rebaja";
  return `${etiqueta} · ${formatter.format(oferta.precio)} (antes ${formatter.format(oferta.antes)})`;
}

// Milisegundos hasta la próxima medianoche (hora del celular)
function msHastaMedianoche() {
  const ahora = new Date();
  const medianoche = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 0, 0, 1);
  return medianoche - ahora;
}

/* ---------------- MEDIANOCHE ----------------
   Al cambiar el día se vuelven a calcular las ofertas. Lo que estaba
   en el carrito con la oferta de ayer pasa al precio normal y se avisa.
   Se revisa con un temporizador y también al volver a la app (el
   celular frena los temporizadores cuando la pantalla está apagada). */

function revisarCambioDeDia() {
  const hoy = fechaDeHoy();
  if (hoy === diaDeLasOfertas) return false;

  // Precios que tenía el carrito antes del cambio
  const preciosAntes = {};
  Object.keys(cart).forEach(id => {
    const product = productoPorId(id);
    if (product) preciosAntes[id] = { precio: precioUnitarioEnCarrito(product), oferta: ofertaDelProducto(product) };
  });

  diaDeLasOfertas = hoy;
  cacheOfertas.clear();
  cacheFormasDeCompra.clear();

  const cambios = [];
  Object.keys(preciosAntes).forEach(id => {
    const product = productoPorId(id);
    const anterior = preciosAntes[id];
    const ahora = precioUnitarioEnCarrito(product);
    if (ahora === anterior.precio) return;
    cambios.push(anterior.oferta && anterior.oferta.tipo === "hoy"
      ? `Terminó la oferta de "${product.name}": ahora ${formatter.format(ahora)} c/u.`
      : `"${product.name}" cambió de precio: ${formatter.format(anterior.precio)} → ${formatter.format(ahora)}.`);
  });

  saveCart();
  updateWhatsAppLink();
  updateCheckoutUI();
  handleFilterPipeline();
  document.dispatchEvent(new Event("ofertascambiaron"));
  mostrarAvisoCarrito(cambios);
  return true;
}

let temporizadorMedianoche = null;
function programarMedianoche() {
  clearTimeout(temporizadorMedianoche);
  temporizadorMedianoche = setTimeout(() => {
    revisarCambioDeDia();
    programarMedianoche();
  }, msHastaMedianoche());
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && revisarCambioDeDia()) programarMedianoche();
});
window.addEventListener("focus", () => {
  if (revisarCambioDeDia()) programarMedianoche();
});
programarMedianoche();
