/* =========================================================
   PROVEEDORES.JS
   ---------------------------------------------------------
   Palabra reservada "supplier" (cliente/config.js →
   palabrasReservadas.proveedores), para el que hace las compras:

   - Escrita en el buscador abre la lista de todos los proveedores
     (columna supplier del Excel), con cuántos productos tiene cada uno
     y cuántos están sin stock.
   - Al tocar uno se ven solo los productos de ese proveedor, en el
     mismo orden del catálogo, pero primero los SIN STOCK (con su
     barra) y después los que tienen stock.
   - Arriba de los productos queda la barra "🏭 Proveedor" con
     "Cambiar" (vuelve a la lista) y "✕" (vuelve al catálogo).
   - Escribir cualquier otra cosa en el buscador (o borrarlo) también
     vuelve al catálogo.

   Se carga ANTES de app.js: app.js usa proveedorElegido(),
   esDelProveedor() y productosDelProveedorOrdenados().
   ========================================================= */

let proveedorActivo = "";

function proveedorElegido() {
  return proveedorActivo;
}

const SIN_PROVEEDOR = "(sin proveedor)";

function nombreProveedor(product) {
  return String(product?.supplier ?? "").trim() || SIN_PROVEEDOR;
}

function esDelProveedor(product, proveedor) {
  return nombreProveedor(product).toLowerCase() === String(proveedor).toLowerCase();
}

// Orden del catálogo, primero los sin stock. Cada grupo con su barra.
function productosDelProveedorOrdenados(lista) {
  const orden = new Map(products.map((product, indice) => [product, indice]));
  const enOrden = lista
    .filter(product => tipoMuestra(product) === "producto")
    .sort((a, b) => orden.get(a) - orden.get(b));
  const sinStock = enOrden.filter(product => !product.inStock);
  const conStock = enOrden.filter(product => product.inStock);

  const barra = nombre => ({ TipoMuestra: "separador", name: nombre });
  const resultado = [];
  if (sinStock.length) resultado.push(barra(`⛔ Sin stock (${sinStock.length})`), ...sinStock);
  if (conStock.length) {
    if (sinStock.length) resultado.push(barra(`✅ Con stock (${conStock.length})`));
    resultado.push(...conStock);
  }
  return resultado;
}

(function () {
  let velo = null;
  let barraProveedor = null;

  // Proveedores con su cantidad de productos y de sin stock
  function listaDeProveedores() {
    const datos = new Map();
    products.forEach(product => {
      if (tipoMuestra(product) !== "producto") return;
      const nombre = nombreProveedor(product);
      const clave = nombre.toLowerCase();
      if (!datos.has(clave)) datos.set(clave, { nombre, total: 0, sinStock: 0 });
      const dato = datos.get(clave);
      dato.total += 1;
      if (!product.inStock) dato.sinStock += 1;
    });
    return [...datos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  function nodo(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);
    if (clase) elemento.className = clase;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
  }

  function abrirLista() {
    if (!velo) {
      velo = nodo("div", "proveedoresVelo");
      velo.setAttribute("role", "dialog");
      velo.setAttribute("aria-modal", "true");
      velo.setAttribute("aria-label", "Proveedores");
      velo.addEventListener("click", evento => {
        if (evento.target === velo) cerrarLista();
      });
      document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") cerrarLista();
      });
      document.body.appendChild(velo);
    }

    velo.replaceChildren();
    const hoja = nodo("div", "proveedoresHoja");

    const cabecera = nodo("div", "proveedoresCabecera");
    cabecera.appendChild(nodo("h2", "", "🏭 Proveedores"));
    const cerrar = nodo("button", "proveedoresCerrar", "✕");
    cerrar.type = "button";
    cerrar.setAttribute("aria-label", "Cerrar");
    cerrar.onclick = cerrarLista;
    cabecera.appendChild(cerrar);
    hoja.appendChild(cabecera);

    hoja.appendChild(nodo("p", "proveedoresAyuda",
      "Tocá un proveedor para ver sus productos: primero los que están sin stock."));

    const ul = nodo("ul", "proveedoresLista");
    listaDeProveedores().forEach(dato => {
      const li = document.createElement("li");
      const boton = nodo("button", "proveedorItem");
      boton.type = "button";
      if (dato.nombre.toLowerCase() === proveedorActivo.toLowerCase()) boton.classList.add("activo");
      boton.appendChild(nodo("span", "proveedorNombre", dato.nombre));
      const datos = nodo("span", "proveedorDatos");
      if (dato.sinStock) datos.appendChild(nodo("span", "proveedorSinStock", `${dato.sinStock} sin stock`));
      datos.appendChild(nodo("span", "proveedorTotal", `${dato.total}`));
      boton.appendChild(datos);
      boton.onclick = () => elegir(dato.nombre);
      li.appendChild(boton);
      ul.appendChild(li);
    });
    hoja.appendChild(ul);
    velo.appendChild(hoja);

    velo.hidden = false;
    document.body.classList.add("pedidoAbierto");   // sin scroll de fondo
  }

  function cerrarLista() {
    if (!velo || velo.hidden) return;
    velo.hidden = true;
    document.body.classList.remove("pedidoAbierto");
  }

  function elegir(proveedor) {
    cerrarLista();
    proveedorActivo = proveedor;
    pintarBarra(proveedor);
    handleFilterPipeline();
    const grilla = document.getElementById("productGrid");
    const arriba = (barraProveedor || grilla).getBoundingClientRect().top + window.scrollY - 70;
    window.scrollTo({ top: Math.max(0, arriba), behavior: "auto" });
  }

  function salir() {
    if (!proveedorActivo) return;
    proveedorActivo = "";
    pintarBarra("");
    handleFilterPipeline();
  }

  function pintarBarra(nombre) {
    if (!barraProveedor) {
      const grilla = document.getElementById("productGrid");
      if (!grilla) return;
      barraProveedor = nodo("div", "proveedorBarra");
      grilla.before(barraProveedor);
    }
    barraProveedor.replaceChildren();
    barraProveedor.hidden = !nombre;
    if (!nombre) return;

    const texto = nodo("span", "proveedorBarraTexto");
    texto.append("🏭 ", nodo("b", "", nombre));
    barraProveedor.appendChild(texto);

    const cambiar = nodo("button", "proveedorBarraCambiar", "Cambiar");
    cambiar.type = "button";
    cambiar.onclick = abrirLista;
    barraProveedor.appendChild(cambiar);

    const quitar = nodo("button", "proveedorBarraSalir", "✕");
    quitar.type = "button";
    quitar.setAttribute("aria-label", "Volver al catálogo");
    quitar.onclick = salir;
    barraProveedor.appendChild(quitar);
  }

  function iniciar() {
    if (typeof searchInput === "undefined" || !searchInput) return;

    searchInput.addEventListener("input", () => {
      if (esPalabraReservada(searchInput.value, "proveedores")) {
        proveedorActivo = "";
        pintarBarra("");
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        searchInput.blur();
        const sugerencias = document.getElementById("searchSuggestions");
        if (sugerencias) sugerencias.hidden = true;
        abrirLista();
        return;
      }
      // Escribir otra cosa (o borrar el buscador) vuelve al catálogo
      if (proveedorActivo) salir();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
