/* =========================================================
   CHIPS.JS
   ---------------------------------------------------------
   Fila de chips debajo del buscador (Ofertas, Limpieza, Sin TACC…).
   Los chips se configuran en cliente/config.js (sección chips).

   - Los chips se combinan: con Niños + Sin TACC marcados se ven
     los productos que están en los dos. Tocar uno marcado lo quita.
   - También se combinan con el buscador: lo que se escriba se busca
     solo dentro de los chips marcados.
   - Un chip sin productos no se muestra.
   - Los chips marcados aparecen dentro del buscador, cada uno con
     su X: tocándolo se quita ese filtro.

   Usa chipsActivos, handleFilterPipeline(), irArriba() y
   crearIconoChip() de app.js, y CHIPS / productoEnChip() de js/datos.js.
   ========================================================= */

(function () {

  const barra = document.getElementById("chipsBar");
  if (!barra) return;

  function tieneProductos(chip) {
    return productosVendibles.some(product => productoEnChip(product, chip));
  }

  // Chips que cambian solos: Favoritos (al marcar un corazón) y los de
  // ofertas (a la medianoche). Se arman igual y aparecen cuando tienen productos.
  function esCambiante(chip) {
    return Boolean(chip.especial || chip.oferta);
  }

  // Solo los chips que tienen al menos un producto.
  const chipsConProductos = CHIPS.filter(chip => esCambiante(chip) || tieneProductos(chip));

  if (chipsConProductos.length === 0) {
    barra.hidden = true;
    return;
  }

  const lista = document.createElement("div");
  lista.className = "chipsLista";
  lista.setAttribute("role", "toolbar");
  lista.setAttribute("aria-label", "Filtros rápidos");

  chipsConProductos.forEach(chip => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "chip";
    boton.dataset.clave = chip.clave;
    boton.setAttribute("aria-pressed", "false");

    const icono = crearIconoChip(chip, "chipIcono");
    if (icono) {
      icono.setAttribute("aria-hidden", "true");
      boton.appendChild(icono);
    }

    const texto = document.createElement("span");
    texto.className = "chipTexto";
    texto.textContent = chip.texto;
    boton.appendChild(texto);

    boton.addEventListener("click", () => alternarChip(chip));
    lista.appendChild(boton);
  });

  barra.appendChild(lista);

  // Flechas a los costados (computadora), como en YouTube
  ["izquierda", "derecha"].forEach(lado => {
    const flecha = document.createElement("button");
    flecha.type = "button";
    flecha.className = `chipsFlecha chipsFlecha-${lado}`;
    flecha.setAttribute("aria-label", lado === "izquierda" ? "Ver chips anteriores" : "Ver más chips");
    flecha.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${lado === "izquierda" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}"/></svg>`;
    flecha.addEventListener("click", () => {
      const paso = lista.clientWidth * 0.7 * (lado === "izquierda" ? -1 : 1);
      lista.scrollBy({ left: paso, behavior: "smooth" });
    });
    barra.appendChild(flecha);
  });

  // Chips especiales: aparecen y desaparecen según tengan productos
  function actualizarVisibles() {
    let alguno = false;
    lista.querySelectorAll(".chip").forEach(boton => {
      const chip = chipsConProductos.find(otro => otro.clave === boton.dataset.clave);
      const marcado = chipsActivos.some(activo => activo.clave === chip.clave);
      boton.hidden = esCambiante(chip) && !marcado && !tieneProductos(chip);
      if (!boton.hidden) alguno = true;
    });
    barra.hidden = !alguno;
    requestAnimationFrame(marcarBordes);
  }
  document.addEventListener("favoritoscambiaron", actualizarVisibles);
  document.addEventListener("ofertascambiaron", actualizarVisibles);


  /* ---------------- DESLIZAR LA FILA ---------------- */
  // En el celular se desliza con el dedo. En la computadora también
  // se puede arrastrar con el mouse o usar la rueda.

  let arrastre = null;
  let huboArrastre = false;

  lista.addEventListener("pointerdown", evento => {
    if (evento.pointerType !== "mouse" || evento.button !== 0) return;
    arrastre = { x: evento.clientX, inicio: lista.scrollLeft };
    huboArrastre = false;
  });

  window.addEventListener("pointermove", evento => {
    if (!arrastre) return;
    const distancia = evento.clientX - arrastre.x;
    if (Math.abs(distancia) > 5) {
      huboArrastre = true;
      lista.classList.add("arrastrando");
    }
    if (huboArrastre) lista.scrollLeft = arrastre.inicio - distancia;
  });

  window.addEventListener("pointerup", () => {
    arrastre = null;
    lista.classList.remove("arrastrando");
  });

  // Si se arrastró, soltar el mouse no marca el chip
  lista.addEventListener("click", evento => {
    if (!huboArrastre) return;
    evento.stopPropagation();
    evento.preventDefault();
    huboArrastre = false;
  }, true);

  // Rueda del mouse (vertical) → desliza la fila
  lista.addEventListener("wheel", evento => {
    if (lista.scrollWidth <= lista.clientWidth) return;
    if (Math.abs(evento.deltaY) <= Math.abs(evento.deltaX)) return;
    const alFinal = lista.scrollLeft + lista.clientWidth >= lista.scrollWidth - 1;
    const alPrincipio = lista.scrollLeft <= 0;
    if ((evento.deltaY > 0 && alFinal) || (evento.deltaY < 0 && alPrincipio)) return;
    lista.scrollLeft += evento.deltaY;
    evento.preventDefault();
  }, { passive: false });

  // Desvanecido de los bordes: cada lado se desvanece en proporción a lo
  // que queda escondido de ese lado (hasta 56 px). Al principio solo la
  // derecha, en el medio los dos y al final solo la izquierda.
  const ANCHO_DESVANECIDO = 56;

  function marcarBordes() {
    const recorrido = Math.max(0, lista.scrollWidth - lista.clientWidth);
    const izquierda = Math.min(ANCHO_DESVANECIDO, lista.scrollLeft);
    const derecha = Math.min(ANCHO_DESVANECIDO, Math.max(0, recorrido - lista.scrollLeft));
    lista.style.setProperty("--borde-izq", `${izquierda}px`);
    lista.style.setProperty("--borde-der", `${derecha}px`);
    barra.classList.toggle("masALaIzquierda", izquierda > 2);
    barra.classList.toggle("masALaDerecha", derecha > 2);
  }
  lista.addEventListener("scroll", marcarBordes, { passive: true });
  window.addEventListener("resize", marcarBordes);
  actualizarVisibles();

  const enBuscador = document.getElementById("chipsEnBuscador");
  const botonBorrarTexto = document.getElementById("clearSearchBtn");

  if (enBuscador) {
    // La X de borrar texto aparece y desaparece al escribir: los chips se corren
    searchInput.addEventListener("input", () => requestAnimationFrame(acomodarBuscador));
    window.addEventListener("resize", acomodarBuscador);
  }


  /* ---------------- MARCAR / DESMARCAR ---------------- */

  function estaMarcado(chip) {
    return chipsActivos.some(activo => activo.clave === chip.clave);
  }

  function alternarChip(chip) {
    const marcar = !estaMarcado(chip);

    // Se mantiene el orden del config, no el orden en que se tocaron
    chipsActivos = chipsConProductos.filter(otro =>
      otro.clave === chip.clave ? marcar : estaMarcado(otro)
    );

    lista.querySelectorAll(".chip").forEach(boton => {
      const marcado = chipsActivos.some(activo => activo.clave === boton.dataset.clave);
      boton.classList.toggle("activo", marcado);
      boton.setAttribute("aria-pressed", marcado ? "true" : "false");
      if (marcar && boton.dataset.clave === chip.clave) {
        boton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    });

    mostrarEnBuscador();
    handleFilterPipeline();
    irArriba();
    actualizarVisibles();
  }

  // Para abrir un chip desde otro lado (ej. el aviso de favoritos)
  window.marcarChip = function (clave) {
    const chip = chipsConProductos.find(otro => otro.clave === clave);
    if (chip && !estaMarcado(chip)) alternarChip(chip);
  };


  /* ---------------- CHIPS DENTRO DEL BUSCADOR ---------------- */
  // Uno solo: ícono + nombre. Varios: solo los íconos, para que entren.

  function mostrarEnBuscador() {
    if (!enBuscador) return;
    enBuscador.replaceChildren();

    const soloIconos = chipsActivos.length > 1;
    enBuscador.classList.toggle("soloIconos", soloIconos);

    chipsActivos.forEach(chip => {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "chipEnBuscador";
      boton.setAttribute("aria-label", `Quitar filtro ${chip.texto}`);
      boton.title = chip.texto;

      const icono = crearIconoChip(chip, "chipEnBuscadorIcono");
      if (icono) boton.appendChild(icono);

      if (!soloIconos || !icono) {
        const texto = document.createElement("span");
        texto.className = "chipEnBuscadorTexto";
        texto.textContent = chip.texto;
        boton.appendChild(texto);
      }

      const quitar = document.createElement("span");
      quitar.className = "chipEnBuscadorQuitar";
      quitar.setAttribute("aria-hidden", "true");
      quitar.textContent = "×";
      boton.appendChild(quitar);

      boton.addEventListener("click", evento => {
        evento.preventDefault();
        alternarChip(chip);
      });
      enBuscador.appendChild(boton);
    });

    enBuscador.hidden = chipsActivos.length === 0;
    acomodarBuscador();
  }

  // Ubica los chips a la izquierda de la X de borrar (si está) y del
  // micrófono, y deja lugar en el texto para que no quede tapado.
  function acomodarBuscador() {
    if (!enBuscador) return;
    const hayTexto = botonBorrarTexto && !botonBorrarTexto.classList.contains("hidden");
    const derecha = hayTexto ? 80 : 50;
    enBuscador.style.right = `${derecha}px`;
    searchInput.style.paddingRight = enBuscador.hidden
      ? ""
      : `${derecha + enBuscador.offsetWidth + 8}px`;
  }

})();
