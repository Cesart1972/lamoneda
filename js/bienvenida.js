/* =========================================================
   BIENVENIDA.JS
   ---------------------------------------------------------
   Modal de bienvenida con el personaje y las condiciones de
   venta. Se muestra una vez por día y cuando el cliente toca
   "Info" en el encabezado.

   Los textos están en cliente/config.js (sección bienvenida).
   ========================================================= */

(function () {

  const config = CLIENTE.bienvenida;
  if (!config) return;

  const CLAVE_DIA = "bienvenidaVistaEl";

  const formatoMoneda = new Intl.NumberFormat(CLIENTE.empresa.idioma, {
    style: "currency",
    currency: CLIENTE.empresa.moneda,
    maximumFractionDigits: 0
  });

  // Variables que se pueden usar en los textos
  function completar(texto) {
    return textoCliente(texto, {
      empresa: CLIENTE.empresa.nombreCorto || CLIENTE.empresa.nombre,
      compraMinima: formatoMoneda.format(CLIENTE.pedido?.compraMinima || 0),
      alias: CLIENTE.pedido?.alias || ""
    });
  }

  // "Si pedís antes de las 16 h, **te llega en el día.**" → texto con negrita
  function conNegritas(texto) {
    const fragmento = document.createDocumentFragment();
    completar(texto).split("**").forEach((parte, i) => {
      if (!parte) return;
      if (i % 2 === 1) {
        const fuerte = document.createElement("strong");
        fuerte.textContent = parte;
        fragmento.appendChild(fuerte);
      } else {
        fragmento.appendChild(document.createTextNode(parte));
      }
    });
    return fragmento;
  }

  function nodo(etiqueta, clase, contenido) {
    const elemento = document.createElement(etiqueta);
    if (clase) elemento.className = clase;
    if (typeof contenido === "string") elemento.textContent = contenido;
    else if (contenido) elemento.appendChild(contenido);
    return elemento;
  }

  function hoy() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  let velo = null;
  let ultimoFoco = null;

  function construir() {
    velo = nodo("div", "bienvenidaVelo");
    velo.hidden = true;

    const modal = nodo("div", "bienvenidaModal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "bienvenidaTitulo");
    modal.tabIndex = -1;

    if (config.imagen) {
      const imagen = nodo("img", "bienvenidaMascota");
      imagen.src = config.imagen;
      imagen.alt = "";
      modal.appendChild(imagen);
    } else {
      modal.classList.add("sinMascota");
    }

    const contenido = nodo("div", "bienvenidaContenido");
    const saludo = nodo("p", "bienvenidaSaludo", completar(config.saludo || ""));
    if (config.saludoIcono) {
      const mano = document.createElement("img");
      mano.className = "bienvenidaSaludoMano";
      mano.src = config.saludoIcono;
      mano.alt = "";
      saludo.appendChild(mano);
    }
    contenido.appendChild(saludo);

    const titulo = nodo("h2", "bienvenidaTitulo", completar(config.titulo || ""));
    titulo.id = "bienvenidaTitulo";
    contenido.appendChild(titulo);

    if (config.intro) contenido.appendChild(nodo("p", "bienvenidaIntro", completar(config.intro)));

    const lista = nodo("ul", "bienvenidaDudas");
    (config.items || []).forEach((item, posicion) => {
      const fila = nodo("li", "bienvenidaDuda");
      fila.style.animationDelay = `${0.45 + posicion * 0.1}s`;
      const icono = nodo("div", "bienvenidaIcono");
      if (typeof esIconoImagen === "function" && esIconoImagen(item.icono)) {
        const imagen = document.createElement("img");
        imagen.src = item.icono;
        imagen.alt = "";
        icono.classList.add("bienvenidaIcono3d");
        icono.appendChild(imagen);
      } else {
        icono.textContent = item.icono || "•";
      }
      fila.appendChild(icono);

      const textos = nodo("div");
      textos.appendChild(nodo("b", "", completar(item.pregunta || "")));
      textos.appendChild(nodo("span", "bienvenidaRespuesta", conNegritas(item.respuesta || "")));

      if (item.alias && CLIENTE.pedido?.alias) {
        const alias = nodo("span", "bienvenidaAlias", `Alias: ${CLIENTE.pedido.alias}`);
        const copiar = nodo("button", "", "Copiar");
        copiar.type = "button";
        copiar.onclick = copiarAlias;
        alias.appendChild(copiar);
        textos.appendChild(alias);
      }

      fila.appendChild(textos);
      lista.appendChild(fila);
    });
    contenido.appendChild(lista);

    if (config.cierre) {
      const cierre = nodo("p", "bienvenidaCierre");
      cierre.appendChild(conNegritas(config.cierre));   // solo lo que va entre ** ** en negrita
      contenido.appendChild(cierre);
    }

    const boton = nodo("button", "bienvenidaBoton", completar(config.boton || "Continuar"));
    boton.type = "button";
    boton.onclick = cerrar;
    contenido.appendChild(boton);

    if (config.nota) contenido.appendChild(nodo("p", "bienvenidaNota", completar(config.nota)));
    // Créditos de Ces.Art (js/creditos.js)
    if (typeof crearLinkCreditos === "function") contenido.appendChild(crearLinkCreditos("creditosBienvenida"));

    modal.appendChild(contenido);
    velo.appendChild(modal);
    // Aviso "¡Alias copiado!": solo si algún ítem muestra el alias
    if ((config.items || []).some(item => item.alias) && CLIENTE.pedido?.alias) {
      velo.appendChild(nodo("div", "bienvenidaToast", "¡Alias copiado!"));
    }

    // Tocar afuera del cuadro también cierra
    velo.addEventListener("click", evento => {
      if (evento.target === velo) cerrar();
    });

    document.addEventListener("keydown", evento => {
      if (evento.key === "Escape" && velo && !velo.hidden) cerrar();
    });

    document.body.appendChild(velo);
  }

  async function copiarAlias() {
    const alias = CLIENTE.pedido?.alias || "";
    try {
      await navigator.clipboard.writeText(alias);
    } catch (e) {
      // Si el navegador no deja copiar, igual se ve el alias en pantalla
    }
    const toast = velo.querySelector(".bienvenidaToast");
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 1500);
  }

  function abrir() {
    if (!velo) construir();
    ultimoFoco = document.activeElement;
    velo.hidden = false;
    // Reinicia las animaciones cada vez que se abre
    velo.classList.remove("animar");
    void velo.offsetWidth;
    velo.classList.add("animar");
    document.body.classList.add("bienvenidaAbierta");
    velo.querySelector(".bienvenidaModal").focus({ preventScroll: true });
  }

  function cerrar() {
    if (!velo) return;
    velo.hidden = true;
    document.body.classList.remove("bienvenidaAbierta");
    window.bienvenidaCerrada = true;
    try { localStorage.setItem(CLAVE_DIA, hoy()); } catch (e) {}
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus({ preventScroll: true });
  }

  // Botón "Info" del encabezado
  document.getElementById("btnInfo")?.addEventListener("click", abrir);

  // Una vez por día. Se arma enseguida (escondida) para que sus imágenes
  // carguen mientras está la portada, y se abre cuando la portada se va
  // (evento "applista" de index.html).
  let mostrarHoy = config.mostrar !== false;
  try { if (localStorage.getItem(CLAVE_DIA) === hoy()) mostrarHoy = false; } catch (e) {}

  if (mostrarHoy) {
    construir();
    let abierta = false;
    const abrirUnaVez = () => {
      if (abierta) return;
      abierta = true;
      setTimeout(abrir, 350);
    };
    if (window.appLista) abrirUnaVez();
    else document.addEventListener("applista", abrirUnaVez, { once: true });
    // Por si la página no tiene portada de carga
    window.addEventListener("load", () => setTimeout(() => {
      if (!document.getElementById("pantallaCarga")) abrirUnaVez();
    }, 0));
  }

  window.abrirBienvenida = abrir;

})();
