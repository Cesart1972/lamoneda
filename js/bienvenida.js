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
    contenido.appendChild(nodo("p", "bienvenidaSaludo", completar(config.saludo || "")));

    const titulo = nodo("h2", "bienvenidaTitulo", completar(config.titulo || ""));
    titulo.id = "bienvenidaTitulo";
    contenido.appendChild(titulo);

    if (config.intro) contenido.appendChild(nodo("p", "bienvenidaIntro", completar(config.intro)));

    const lista = nodo("ul", "bienvenidaDudas");
    (config.items || []).forEach((item, posicion) => {
      const fila = nodo("li", "bienvenidaDuda");
      fila.style.animationDelay = `${0.45 + posicion * 0.1}s`;
      fila.appendChild(nodo("div", "bienvenidaIcono", item.icono || "•"));

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

    if (config.cierre) contenido.appendChild(nodo("p", "bienvenidaCierre", completar(config.cierre)));

    const boton = nodo("button", "bienvenidaBoton", completar(config.boton || "Continuar"));
    boton.type = "button";
    boton.onclick = cerrar;
    contenido.appendChild(boton);

    if (config.nota) contenido.appendChild(nodo("p", "bienvenidaNota", completar(config.nota)));

    modal.appendChild(contenido);
    velo.appendChild(modal);
    velo.appendChild(nodo("div", "bienvenidaToast", "¡Alias copiado!"));

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
    try { localStorage.setItem(CLAVE_DIA, hoy()); } catch (e) {}
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus({ preventScroll: true });
  }

  // Botón "Info" del encabezado
  document.getElementById("btnInfo")?.addEventListener("click", abrir);

  // Una vez por día, al terminar de cargar el catálogo
  window.addEventListener("load", () => {
    if (config.mostrar === false) return;
    let vistoHoy = false;
    try { vistoHoy = localStorage.getItem(CLAVE_DIA) === hoy(); } catch (e) {}
    if (!vistoHoy) setTimeout(abrir, 350);
  });

  window.abrirBienvenida = abrir;

})();
