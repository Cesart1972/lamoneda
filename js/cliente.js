/* =========================================================
   CLIENTE.JS
   ---------------------------------------------------------
   Aplica la configuración de cliente/config.js a la página.
   Este archivo es parte del programa: es igual para todas
   las distribuidoras. No hace falta modificarlo.

   Se carga en el <head>, justo después de cliente/config.js,
   para que los colores estén aplicados antes de que se vea
   la página.
   ========================================================= */


/* ---------------- TEXTOS CON VARIABLES ---------------- */

// Reemplaza {vendedor}, {link}, etc. dentro de un texto de config.js
function textoCliente(plantilla, variables = {}) {

  const valores = {
    vendedor: CLIENTE.whatsapp.nombreVendedor,
    empresa: CLIENTE.empresa.nombre,
    ...variables
  };

  return String(plantilla || "").replace(
    /\{(\w+)\}/g,
    (coincidencia, clave) =>
      clave in valores ? valores[clave] : coincidencia
  );
}


/* ---------------- REGLAS DE BÚSQUEDA ---------------- */

// El motor de búsqueda (js/search-engine-v1.js) lee esta constante.
const SEARCH_RULES = CLIENTE.reglasBusqueda || [];


/* ---------------- FILTROS AVANZADOS ---------------- */

const FILTROS = CLIENTE.filtros || [];

// Devuelve todos los filtros en "ALL" (sin filtrar)
function filtrosVacios() {
  const estado = {};
  FILTROS.forEach(filtro => {
    estado[filtro.campo] = "ALL";
  });
  return estado;
}


/* ---------------- COLORES (inmediato) ---------------- */

(function aplicarColores() {

  const colores = CLIENTE.colores || {};
  const raiz = document.documentElement.style;

  // color de config.js  →  variables CSS que ya usan las hojas de estilo
  const mapa = {
    principal: ["--color-principal"],
    secundario: ["--color-secundario"],
    boton: ["--accent"],
    botonOscuro: ["--accent-strong"],
    fondo: ["--bg"]
  };

  Object.entries(mapa).forEach(([clave, variables]) => {
    if (colores[clave]) {
      variables.forEach(variable =>
        raiz.setProperty(variable, colores[clave])
      );
    }
  });

  const metaTema = document.getElementById("themeColor");
  if (metaTema && colores.principal) {
    metaTema.content = colores.principal;
  }

  document.title = CLIENTE.empresa.nombre;

})();


/* ---------------- DATOS DE LA EMPRESA EN LA PÁGINA ---------------- */

document.addEventListener("DOMContentLoaded", () => {

  const empresa = CLIENTE.empresa;

  const asignar = (id, propiedad, valor) => {
    const elemento = document.getElementById(id);
    if (elemento && valor !== undefined) elemento[propiedad] = valor;
  };

  asignar("description", "content", empresa.descripcion);
  asignar("appleTitle", "content", empresa.nombreCorto || empresa.nombre);
  asignar("favicon", "href", empresa.favicon);
  asignar("logoEmpresa", "src", empresa.logo);
  asignar("tituloCatalogo", "textContent", empresa.tituloCatalogo);

  // Botón flotante de WhatsApp (consulta)
  asignar(
    "whatsappBtn",
    "href",
    `https://wa.me/${CLIENTE.whatsapp.numero}?text=` +
      encodeURIComponent(textoCliente(CLIENTE.mensajes.consulta))
  );

  crearGruposDeFiltros();
});


// Arma los botones del panel de filtros avanzados según config.js
function crearGruposDeFiltros() {

  const contenedor = document.querySelector("#filterModal .modalContent");
  const botonLimpiar = document.getElementById("clearFiltersBtn");

  if (!contenedor) return;

  FILTROS.forEach(filtro => {

    const grupo = document.createElement("div");
    grupo.className = "filterGroup";
    grupo.dataset.filter = filtro.campo;

    const disparador = document.createElement("button");
    disparador.className = "customSelectTrigger";
    disparador.type = "button";
    disparador.textContent = filtro.titulo;

    const opciones = document.createElement("div");
    opciones.className = "optionsDropdown";
    opciones.hidden = true;

    grupo.append(disparador, opciones);
    contenedor.insertBefore(grupo, botonLimpiar);
  });
}
