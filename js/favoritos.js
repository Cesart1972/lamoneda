/* =========================================================
   FAVORITOS.JS
   ---------------------------------------------------------
   El cliente marca productos con el corazón para tenerlos en
   cuenta la próxima vez. Lo que ya compró (pedido enviado por
   WhatsApp) también queda como favorito.

   - Se guarda en el celular del cliente (no hace falta servidor).
   - El chip "Favoritos" muestra esos productos (cliente/config.js).
   - Al volver a entrar, un aviso le recuerda los favoritos que
     todavía no agregó al pedido (una vez por día).

   Se carga después de js/datos.js y antes de app.js.
   ========================================================= */

const FAVORITOS_KEY = "favoritos";
const favoritos = new Set();

try {
  const guardados = JSON.parse(localStorage.getItem(FAVORITOS_KEY) || "[]");
  if (Array.isArray(guardados)) guardados.forEach(id => favoritos.add(String(id)));
} catch (error) {
  // Sin acceso al almacenamiento: los favoritos duran hasta cerrar la app
}

function guardarFavoritos() {
  try {
    localStorage.setItem(FAVORITOS_KEY, JSON.stringify([...favoritos]));
  } catch (error) {}
  document.dispatchEvent(new CustomEvent("favoritoscambiaron"));
}

function esFavorito(product) {
  return Boolean(product) && favoritos.has(String(product.Id));
}

// Marca o desmarca. Devuelve true si quedó como favorito.
function alternarFavorito(product) {
  const id = String(product.Id);
  if (favoritos.has(id)) favoritos.delete(id);
  else favoritos.add(id);
  guardarFavoritos();
  return favoritos.has(id);
}

// Al enviar un pedido, lo comprado pasa a favoritos
function agregarAFavoritos(ids) {
  let cambio = false;
  (ids || []).forEach(id => {
    if (!favoritos.has(String(id))) {
      favoritos.add(String(id));
      cambio = true;
    }
  });
  if (cambio) guardarFavoritos();
}


/* ---------------- CORAZÓN EN LA TARJETA ---------------- */

const ICONO_FAVORITO = "imagenes/iconos/corazon.svg";
const ICONO_NO_FAVORITO = "imagenes/iconos/corazon-vacio.svg";

function crearBotonFavorito(product) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "botonFavorito";

  const imagen = document.createElement("img");
  imagen.alt = "";
  imagen.decoding = "async";
  boton.appendChild(imagen);

  const pintar = () => {
    const activo = esFavorito(product);
    boton.classList.toggle("activo", activo);
    boton.setAttribute("aria-pressed", activo ? "true" : "false");
    boton.setAttribute("aria-label", activo
      ? `Quitar ${product.name} de favoritos`
      : `Guardar ${product.name} en favoritos`);
    imagen.src = activo ? ICONO_FAVORITO : ICONO_NO_FAVORITO;
  };

  boton.addEventListener("click", evento => {
    evento.stopPropagation();
    alternarFavorito(product);
    pintar();
    // Pequeño "latido" al tocarlo
    boton.classList.remove("latido");
    void boton.offsetWidth;
    boton.classList.add("latido");
  });

  pintar();
  return boton;
}


/* ---------------- AVISO AL VOLVER A ENTRAR ---------------- */

(function () {
  const CLAVE_AVISO = "avisoFavoritosEl";

  function hoy() {
    const fecha = new Date();
    return `${fecha.getFullYear()}-${fecha.getMonth() + 1}-${fecha.getDate()}`;
  }

  function favoritosSinAgregar() {
    if (typeof productoPorId !== "function") return 0;
    return [...favoritos].filter(id => {
      const product = productoPorId(id);
      return product && product.inStock && !(typeof cart !== "undefined" && cart[id] > 0);
    }).length;
  }

  function mostrarAviso(cantidad) {
    const aviso = document.createElement("div");
    aviso.className = "avisoFavoritos";
    aviso.setAttribute("role", "status");
    aviso.innerHTML = `
      <img src="${ICONO_FAVORITO}" alt="" class="avisoFavoritosIcono">
      <span class="avisoFavoritosTexto"></span>
      <button type="button" class="avisoFavoritosVer">Ver</button>
      <button type="button" class="avisoFavoritosCerrar" aria-label="Cerrar">×</button>`;
    aviso.querySelector(".avisoFavoritosTexto").textContent = cantidad === 1
      ? "Tenés 1 favorito para agregar"
      : `Tenés ${cantidad} favoritos para agregar`;

    const cerrar = () => {
      aviso.classList.remove("visible");
      setTimeout(() => aviso.remove(), 400);
    };
    aviso.querySelector(".avisoFavoritosVer").onclick = () => {
      if (typeof window.marcarChip === "function") window.marcarChip("favoritos");
      cerrar();
    };
    aviso.querySelector(".avisoFavoritosCerrar").onclick = cerrar;

    document.body.appendChild(aviso);
    requestAnimationFrame(() => requestAnimationFrame(() => aviso.classList.add("visible")));
    setTimeout(cerrar, 9000);
  }

  function intentar(intentos) {
    // Espera a que se vaya la portada de carga y se cierre la bienvenida
    const bienvenida = document.querySelector(".bienvenidaVelo");
    const conPortada = document.getElementById("pantallaCarga") && !window.appLista;
    const bienvenidaPorAbrir = bienvenida && !window.bienvenidaCerrada;
    if ((conPortada || (bienvenida && (!bienvenida.hidden || bienvenidaPorAbrir))) && intentos > 0) {
      setTimeout(() => intentar(intentos - 1), 700);
      return;
    }
    const cantidad = favoritosSinAgregar();
    if (cantidad === 0) return;
    try {
      if (localStorage.getItem(CLAVE_AVISO) === hoy()) return;
      localStorage.setItem(CLAVE_AVISO, hoy());
    } catch (error) {}
    mostrarAviso(cantidad);
  }

  window.addEventListener("load", () => setTimeout(() => intentar(120), 1500));
})();
