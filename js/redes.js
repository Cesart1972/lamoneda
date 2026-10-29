/* =========================================================
   REDES.JS
   ---------------------------------------------------------
   Placas para redes de las ofertas "Solo x hoy".

   Escribiendo la palabra reservada "redes" en el buscador
   (cliente/config.js → palabrasReservadas.redes) se arma una
   imagen cuadrada (1080 × 1080, ratio 1:1) por cada oferta del
   día y se abre una ventana para guardarlas en el celular:
   - "Guardar todas": en Android se descargan (aparecen en la
     galería, álbum Descargas); en iPhone se abre el menú de
     compartir con "Guardar imágenes" (van a Fotos).
   - "Compartir": manda todas juntas a WhatsApp, Instagram, etc.
   - Tocando una placa se guarda solo esa.

   Cada placa lleva: la foto con un marco blanco y luminoso sobre
   el color de la empresa, la cinta "Solo x hoy! 29/10", el logo y el
   nombre de la empresa arriba a la derecha (chiquito) y el precio
   destacado abajo a la izquierda, con el precio normal tachado y
   el % de ahorro.

   Qué ofertas van: las mismas del carrusel. Un grupo (poster) con
   todas sus variedades en la misma oferta es una sola placa. Las
   agotadas no van.

   Textos y colores: cliente/config.js → redes (todo opcional).
   Usa ofertaDeHoy() y ofertaComunDeVariedades() de js/ofertas.js y
   agruparVariedades(), idProducto(), categoryImage(), formatter,
   esPalabraReservada() y searchInput de app.js.
   ========================================================= */

(function () {

  if (typeof searchInput === "undefined" || !searchInput) return;

  const LADO = 1080;                      // px (1:1)
  const AJUSTES = CLIENTE.redes || {};
  const EMPRESA = CLIENTE.empresa || {};
  const COLOR_FONDO = AJUSTES.colorFondo || (CLIENTE.carga && CLIENTE.carga.fondo) || (CLIENTE.colores && CLIENTE.colores.principal) || "#F75101";
  const TEXTO_CINTA = AJUSTES.cinta || "Solo x hoy!";
  const TEXTO_EMPRESA = AJUSTES.textoEmpresa || EMPRESA.nombre || "";
  const LOGO = AJUSTES.logo || EMPRESA.logo || "";
  const LETRA = '"Fredoka", "Arial Rounded MT Bold", Arial, sans-serif';

  const esIPhone = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  let trabajando = false;


  /* ---------------- QUÉ OFERTAS VAN ---------------- */

  function ofertasParaRedes() {
    const { grupos } = agruparVariedades(products);
    const posterDe = new Map();
    const postersConOferta = new Set();

    grupos.forEach((variedades, posterId) => {
      variedades.forEach(product => posterDe.set(idProducto(product), posterId));
      const oferta = ofertaComunDeVariedades(variedades);
      if (oferta && oferta.tipo === "hoy" && variedades.some(v => v.inStock)) postersConOferta.add(posterId);
    });

    const lista = [];
    products.forEach(product => {
      const id = idProducto(product);
      const tipo = tipoMuestra(product);
      if (tipo === "poster" && postersConOferta.has(id)) {
        lista.push({ product, oferta: ofertaComunDeVariedades(grupos.get(id)) });
      } else if (tipo === "producto") {
        const oferta = ofertaDeHoy(product);
        if (!oferta || !product.inStock || postersConOferta.has(posterDe.get(id))) return;
        lista.push({ product, oferta });
      }
    });
    return lista;
  }


  /* ---------------- AYUDAS DE DIBUJO ---------------- */

  function cargarImagen(src) {
    return new Promise(resolve => {
      if (!src) return resolve(null);
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function rectRedondeado(ctx, x, y, ancho, alto, radio) {
    const r = Math.min(radio, ancho / 2, alto / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + ancho, y, x + ancho, y + alto, r);
    ctx.arcTo(x + ancho, y + alto, x, y + alto, r);
    ctx.arcTo(x, y + alto, x, y, r);
    ctx.arcTo(x, y, x + ancho, y, r);
    ctx.closePath();
  }

  // Foto que cubre el cuadro (recorta lo que sobra, como object-fit: cover)
  function dibujarCubriendo(ctx, img, x, y, ancho, alto) {
    const escala = Math.max(ancho / img.width, alto / img.height);
    const w = img.width * escala;
    const h = img.height * escala;
    ctx.drawImage(img, x + (ancho - w) / 2, y + (alto - h) / 2, w, h);
  }

  function dibujarContenida(ctx, img, x, y, ancho, alto) {
    const escala = Math.min(ancho / img.width, alto / img.height);
    const w = img.width * escala;
    const h = img.height * escala;
    ctx.drawImage(img, x + (ancho - w) / 2, y + (alto - h) / 2, w, h);
  }

  // Achica la letra hasta que el texto entre en el ancho
  function letraQueEntra(ctx, texto, peso, tamano, anchoMaximo, minimo) {
    let t = tamano;
    do {
      ctx.font = `${peso} ${t}px ${LETRA}`;
      if (ctx.measureText(texto).width <= anchoMaximo) break;
      t -= 2;
    } while (t > minimo);
    return t;
  }

  // Corta el texto en renglones (máximo "renglones"; el último con …)
  function renglones(ctx, texto, anchoMaximo, maximo) {
    const palabras = String(texto || "").split(/\s+/).filter(Boolean);
    const lineas = [];
    let actual = "";
    palabras.forEach(palabra => {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (ctx.measureText(prueba).width <= anchoMaximo || !actual) actual = prueba;
      else { lineas.push(actual); actual = palabra; }
    });
    if (actual) lineas.push(actual);
    if (lineas.length > maximo) {
      const cortadas = lineas.slice(0, maximo);
      let ultima = cortadas[maximo - 1];
      while (ultima.length > 1 && ctx.measureText(`${ultima}…`).width > anchoMaximo) ultima = ultima.slice(0, -1);
      cortadas[maximo - 1] = `${ultima.trim()}…`;
      return cortadas;
    }
    return lineas;
  }

  function aclarar(hex, cantidad) {
    const n = parseInt(String(hex).replace("#", ""), 16);
    if (!Number.isFinite(n)) return hex;
    const mezclar = c => Math.round(c + (255 - c) * cantidad);
    return `rgb(${mezclar((n >> 16) & 255)}, ${mezclar((n >> 8) & 255)}, ${mezclar(n & 255)})`;
  }

  function oscurecer(hex, cantidad) {
    const n = parseInt(String(hex).replace("#", ""), 16);
    if (!Number.isFinite(n)) return hex;
    const mezclar = c => Math.round(c * (1 - cantidad));
    return `rgb(${mezclar((n >> 16) & 255)}, ${mezclar((n >> 8) & 255)}, ${mezclar(n & 255)})`;
  }


  /* ---------------- LA PLACA ---------------- */

  async function dibujarPlaca(item, logo) {
    const { product, oferta } = item;
    const canvas = document.createElement("canvas");
    canvas.width = LADO;
    canvas.height = LADO;
    const ctx = canvas.getContext("2d");

    // 1. Fondo: color de la empresa con rayos de luz suaves
    const fondo = ctx.createRadialGradient(LADO / 2, LADO / 2, 80, LADO / 2, LADO / 2, LADO * 0.75);
    fondo.addColorStop(0, aclarar(COLOR_FONDO, 0.25));
    fondo.addColorStop(1, oscurecer(COLOR_FONDO, 0.18));
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, LADO, LADO);

    ctx.save();
    ctx.translate(LADO / 2, LADO / 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(LADO, -70);
      ctx.lineTo(LADO, 70);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 2. Foto con marco: halo amarillo, borde blanco grueso y sombra
    const margen = 56;
    const x = margen, y = margen, lado = LADO - margen * 2;
    const radio = 44;

    ctx.save();
    ctx.shadowColor = "rgba(255, 214, 0, 0.85)";
    ctx.shadowBlur = 46;
    rectRedondeado(ctx, x - 14, y - 14, lado + 28, lado + 28, radio + 14);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    rectRedondeado(ctx, x - 14, y - 14, lado + 28, lado + 28, radio + 14);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.restore();

    // Línea dorada por dentro del borde blanco
    rectRedondeado(ctx, x - 4, y - 4, lado + 8, lado + 8, radio + 4);
    ctx.strokeStyle = "#FFC400";
    ctx.lineWidth = 5;
    ctx.stroke();

    const foto = await cargarImagen(product.image) || await cargarImagen(categoryImage(product.category));
    ctx.save();
    rectRedondeado(ctx, x, y, lado, lado, radio);
    ctx.clip();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x, y, lado, lado);
    if (foto) {
      // Foto cuadrada: la cubre entera. Si no es cuadrada, entra completa.
      const proporcion = foto.width / foto.height;
      if (proporcion > 0.9 && proporcion < 1.1) dibujarCubriendo(ctx, foto, x, y, lado, lado);
      else dibujarContenida(ctx, foto, x + 20, y + 20, lado - 40, lado - 40);
    }
    // Sombreado abajo a la izquierda, para que el precio se lea sobre cualquier foto
    const velo = ctx.createLinearGradient(0, y + lado * 0.55, 0, y + lado);
    velo.addColorStop(0, "rgba(0, 0, 0, 0)");
    velo.addColorStop(1, "rgba(0, 0, 0, 0.28)");
    ctx.fillStyle = velo;
    ctx.fillRect(x, y + lado * 0.55, lado, lado * 0.45);
    ctx.restore();

    // 3. Cinta "Solo x hoy!" en diagonal, arriba a la izquierda
    dibujarCinta(ctx, fechaCortaOferta(oferta.fecha));

    // 4. Logo y nombre de la empresa, arriba a la derecha (sutil)
    dibujarEmpresa(ctx, logo, x + lado - 22, y + 22);

    // 5. Precio destacado, abajo a la izquierda
    dibujarPrecio(ctx, product, oferta, x + 4, y + lado + 6);

    return canvas;
  }

  // Cinta "Solo x hoy! 29/10" (la fecha en amarillo)
  function dibujarCinta(ctx, fecha) {
    ctx.save();
    // Franja a 45° que corta la esquina superior izquierda
    ctx.translate(0, 0);
    ctx.rotate(-Math.PI / 4);
    const alto = 92;
    const centro = 310;          // distancia de la esquina al centro de la franja
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    const degradado = ctx.createLinearGradient(0, centro - alto / 2, 0, centro + alto / 2);
    degradado.addColorStop(0, "#FF2B2B");
    degradado.addColorStop(1, "#C40012");
    ctx.fillStyle = degradado;
    ctx.fillRect(-LADO, centro - alto / 2, LADO * 2, alto);
    ctx.shadowColor = "transparent";

    // Bordes amarillos finitos
    ctx.fillStyle = "#FFD400";
    ctx.fillRect(-LADO, centro - alto / 2, LADO * 2, 5);
    ctx.fillRect(-LADO, centro + alto / 2 - 5, LADO * 2, 5);

    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const textoFecha = fecha ? ` ${fecha}` : "";
    letraQueEntra(ctx, TEXTO_CINTA + textoFecha, 700, 58, 540, 30);
    const anchoCinta = ctx.measureText(TEXTO_CINTA).width;
    const inicio = -ctx.measureText(TEXTO_CINTA + textoFecha).width / 2;
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillText(TEXTO_CINTA, inicio, centro + 3);
    if (textoFecha) {
      ctx.fillStyle = "#FFE600";
      ctx.fillText(textoFecha, inicio + anchoCinta, centro + 3);
    }
    ctx.restore();
  }

  function dibujarEmpresa(ctx, logo, derecha, arriba) {
    const tamLogo = 72;
    const alto = 82;
    ctx.save();
    ctx.font = `600 22px ${LETRA}`;
    const anchoTexto = TEXTO_EMPRESA ? ctx.measureText(TEXTO_EMPRESA).width : 0;
    const ancho = (logo ? tamLogo + 8 : 0) + (anchoTexto ? anchoTexto + 26 : 0) + 10;
    const izquierda = derecha - ancho;

    ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    rectRedondeado(ctx, izquierda, arriba, ancho, alto, alto / 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.fill();
    ctx.shadowColor = "transparent";

    let xTexto = izquierda + 26;
    if (logo) {
      dibujarContenida(ctx, logo, izquierda + 8, arriba + (alto - tamLogo) / 2, tamLogo, tamLogo);
      xTexto = izquierda + tamLogo + 12;
    }
    if (TEXTO_EMPRESA) {
      ctx.fillStyle = "#555555";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(TEXTO_EMPRESA, xTexto, arriba + alto / 2 + 1);
    }
    ctx.restore();
  }

  function dibujarPrecio(ctx, product, oferta, izquierda, abajo) {
    // "$ 1.199" → "$1.199" (sin espacio, se lee mejor en grande)
    const precio = formatter.format(oferta.precio).replace(/\s+/g, "");
    const antes = formatter.format(oferta.antes);

    ctx.save();
    ctx.translate(izquierda, abajo);
    ctx.rotate(-3 * Math.PI / 180);

    // Medidas del cartel según el precio
    const tamPrecio = letraQueEntra(ctx, precio, 700, 168, 500, 90);
    const anchoPrecio = ctx.measureText(precio).width;
    const ancho = Math.max(anchoPrecio + 80, 420);
    const alto = 330;
    const xCartel = 0, yCartel = -alto;

    // Cartel amarillo con borde rojo
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    rectRedondeado(ctx, xCartel, yCartel, ancho, alto, 34);
    const amarillo = ctx.createLinearGradient(0, yCartel, 0, 0);
    amarillo.addColorStop(0, "#FFE94D");
    amarillo.addColorStop(1, "#FFC800");
    ctx.fillStyle = amarillo;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#D90016";
    ctx.stroke();

    // Nombre del producto (chico, hasta 2 renglones)
    ctx.fillStyle = "#2b2b2b";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `600 34px ${LETRA}`;
    const lineas = renglones(ctx, product.name, ancho - 70, 2);
    let yTexto = yCartel + 56;
    if (lineas.length === 1) yTexto += 12;
    lineas.forEach((linea, i) => ctx.fillText(linea, xCartel + 36, yTexto + i * 38));

    // Precio de oferta grande
    ctx.font = `700 ${tamPrecio}px ${LETRA}`;
    ctx.fillStyle = "#D90016";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineJoin = "round";
    const yPrecio = yCartel + 92 + tamPrecio * 0.92;
    ctx.strokeText(precio, xCartel + 36, yPrecio);
    ctx.fillText(precio, xCartel + 36, yPrecio);

    // "antes $1.399" tachado y la fecha
    ctx.font = `600 38px ${LETRA}`;
    ctx.fillStyle = "#4a4a4a";
    const yAntes = yCartel + alto - 30;
    const textoAntes = `antes ${antes}`;
    ctx.fillText(textoAntes, xCartel + 36, yAntes);
    const anchoAntes = ctx.measureText(textoAntes).width;
    const inicioTachado = xCartel + 36 + ctx.measureText("antes ").width;
    ctx.strokeStyle = "#D90016";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(inicioTachado - 4, yAntes - 13);
    ctx.lineTo(xCartel + 36 + anchoAntes + 4, yAntes - 13);
    ctx.stroke();

    // Globito con el % de ahorro, montado en la esquina del cartel
    if (oferta.ahorro > 0) {
      const r = 74;
      const cx = xCartel + ancho - 18, cy = yCartel - 12;
      ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      ctx.beginPath();
      // Estrella de 16 puntas
      for (let i = 0; i < 32; i++) {
        const radioPunta = i % 2 === 0 ? r : r * 0.84;
        const angulo = (Math.PI * 2 * i) / 32;
        const px = cx + Math.cos(angulo) * radioPunta;
        const py = cy + Math.sin(angulo) * radioPunta;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = "#D90016";
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#FFD400";
      ctx.stroke();

      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 48px ${LETRA}`;
      ctx.fillText(`-${oferta.ahorro}%`, cx, cy + 2);
    }
    ctx.restore();
  }


  /* ---------------- ARMAR TODAS ---------------- */

  function nombreArchivo(item, indice) {
    const base = normalize(item.product.name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    return `oferta-${item.oferta.fecha}-${String(indice + 1).padStart(2, "0")}-${base || "producto"}.jpg`;
  }

  function aArchivo(canvas, nombre) {
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        resolve(blob ? new File([blob], nombre, { type: "image/jpeg" }) : null);
      }, "image/jpeg", 0.92);
    });
  }

  async function armarPlacas(alAvanzar) {
    if (document.fonts && document.fonts.load) {
      try {
        await Promise.all([
          document.fonts.load(`700 100px "Fredoka"`),
          document.fonts.load(`600 30px "Fredoka"`)
        ]);
      } catch (error) { /* sin la letra se usa Arial */ }
    }
    const logo = await cargarImagen(LOGO);
    const lista = ofertasParaRedes();
    const placas = [];
    for (let i = 0; i < lista.length; i++) {
      const canvas = await dibujarPlaca(lista[i], logo);
      const archivo = await aArchivo(canvas, nombreArchivo(lista[i], i));
      if (archivo) placas.push({ archivo, url: URL.createObjectURL(archivo), nombre: lista[i].product.name });
      alAvanzar(i + 1, lista.length);
    }
    return placas;
  }


  /* ---------------- GUARDAR / COMPARTIR ---------------- */

  function puedeCompartir(archivos) {
    try {
      return Boolean(navigator.canShare && navigator.share && navigator.canShare({ files: archivos }));
    } catch (error) {
      return false;
    }
  }

  async function compartir(archivos) {
    try {
      await navigator.share({ files: archivos, title: "Ofertas de hoy" });
      return true;
    } catch (error) {
      // Cancelado por el usuario: no es un error
      return error && error.name === "AbortError";
    }
  }

  function descargar(placa) {
    const enlace = document.createElement("a");
    enlace.href = placa.url;
    enlace.download = placa.archivo.name;
    enlace.rel = "noopener";
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  }

  async function guardar(placas) {
    const archivos = placas.map(placa => placa.archivo);
    // iPhone: el menú de compartir tiene "Guardar imágenes" (van a Fotos).
    // Descargando irían a Archivos, que no es la galería.
    if (esIPhone && puedeCompartir(archivos)) {
      await compartir(archivos);
      return;
    }
    // Android y computadora: una descarga por placa, con una pausa
    // (el navegador puede preguntar una vez si permite varias descargas)
    for (let i = 0; i < placas.length; i++) {
      descargar(placas[i]);
      if (i < placas.length - 1) await new Promise(r => setTimeout(r, 350));
    }
    mostrarToastRedes(placas.length === 1
      ? "Placa guardada en Descargas"
      : `${placas.length} placas guardadas en Descargas`);
  }

  function mostrarToastRedes(texto) {
    if (typeof mostrarToast === "function" && document.getElementById("toastCompartir")) mostrarToast(texto);
  }


  /* ---------------- VENTANA ---------------- */

  function elemento(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  }

  function abrirVentana() {
    const velo = elemento("div", "redesVelo");
    velo.setAttribute("role", "dialog");
    velo.setAttribute("aria-modal", "true");
    velo.setAttribute("aria-label", "Placas para redes");

    const caja = elemento("div", "redesCaja");
    const cabecera = elemento("div", "redesCabecera");
    const titulo = elemento("h2", "redesTitulo", "📲 Placas para redes");
    const cerrar = elemento("button", "redesCerrar", "✕");
    cerrar.type = "button";
    cerrar.setAttribute("aria-label", "Cerrar");
    cabecera.append(titulo, cerrar);

    const estado = elemento("p", "redesEstado", "Armando las placas…");
    const grilla = elemento("div", "redesGrilla");
    const botones = elemento("div", "redesBotones");
    const btnGuardar = elemento("button", "redesBoton redesGuardar", "Guardar todas");
    const btnCompartir = elemento("button", "redesBoton redesCompartir", "Compartir");
    btnGuardar.type = btnCompartir.type = "button";
    btnGuardar.disabled = btnCompartir.disabled = true;
    btnCompartir.hidden = true;
    botones.append(btnGuardar, btnCompartir);
    const pista = elemento("p", "redesPista", "Tocá una placa para guardar solo esa.");
    pista.hidden = true;

    caja.append(cabecera, estado, grilla, botones, pista);
    velo.appendChild(caja);
    document.body.appendChild(velo);
    document.body.classList.add("redesAbierta");

    let placas = [];
    const quitar = () => {
      placas.forEach(placa => URL.revokeObjectURL(placa.url));
      velo.remove();
      document.body.classList.remove("redesAbierta");
      document.removeEventListener("keydown", conEscape);
      trabajando = false;
    };
    const conEscape = evento => { if (evento.key === "Escape") quitar(); };
    cerrar.addEventListener("click", quitar);
    velo.addEventListener("click", evento => { if (evento.target === velo) quitar(); });
    document.addEventListener("keydown", conEscape);

    return {
      avance(hechas, total) {
        estado.textContent = `Armando las placas… ${hechas} de ${total}`;
      },
      listas(lista) {
        placas = lista;
        if (lista.length === 0) {
          estado.textContent = "Hoy no hay ofertas \"Solo x hoy\" con stock para publicar.";
          botones.hidden = true;
          return;
        }
        estado.textContent = lista.length === 1
          ? "1 placa lista (1080 × 1080)."
          : `${lista.length} placas listas (1080 × 1080).`;
        lista.forEach(placa => {
          const boton = elemento("button", "redesPlaca");
          boton.type = "button";
          boton.setAttribute("aria-label", `Guardar ${placa.nombre}`);
          const img = elemento("img");
          img.src = placa.url;
          img.alt = placa.nombre;
          boton.appendChild(img);
          boton.addEventListener("click", () => guardar([placa]));
          grilla.appendChild(boton);
        });
        pista.hidden = false;
        btnGuardar.disabled = false;
        btnGuardar.textContent = lista.length === 1 ? "Guardar en el celular" : `Guardar las ${lista.length}`;
        btnGuardar.addEventListener("click", () => guardar(lista));

        const archivos = lista.map(placa => placa.archivo);
        if (!esIPhone && puedeCompartir(archivos)) {
          btnCompartir.hidden = false;
          btnCompartir.disabled = false;
          btnCompartir.addEventListener("click", () => compartir(archivos));
        }
      },
      error() {
        estado.textContent = "No se pudieron armar las placas. Probá de nuevo.";
        botones.hidden = true;
      }
    };
  }

  async function generar() {
    if (trabajando) return;
    trabajando = true;
    const ventana = abrirVentana();
    try {
      const placas = await armarPlacas(ventana.avance);
      ventana.listas(placas);
    } catch (error) {
      console.error("Placas para redes:", error);
      ventana.error();
    }
  }


  /* ---------------- PALABRA RESERVADA ---------------- */

  function esRedes(texto) {
    const palabras = CLIENTE.palabrasReservadas || {};
    if (palabras.redes === undefined) {
      return normalize(String(texto || "").trim()) === "redes";
    }
    return esPalabraReservada(texto, "redes");
  }

  searchInput.addEventListener("input", () => {
    if (!esRedes(searchInput.value)) return;
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    searchInput.blur();
    generar();
  });

  // Para probar desde la consola: generarPlacasRedes()
  window.generarPlacasRedes = generar;

})();
