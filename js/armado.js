/* =========================================================
   ARMADO.JS
   ---------------------------------------------------------
   "Armar pedido" (para la distribuidora, no para el cliente).

   1. Copiás de WhatsApp el pedido que mandó el cliente.
   2. Escribís la palabra reservada "order" en el buscador
      (cliente/config.js → palabrasReservadas.armar) y tocás
      "Pegar pedido". Los productos entran al carrito del celular.
   3. Por cada producto ves cuánto pidió y cuánto entregás (− y +
      de a una unidad). Lo que pidió por bulto se cobra todo al
      PrecioPorVolumen aunque entregues menos ("1 bulto + 5 u.").
   4. Botones de cada producto:
        HECHO     → ya está puesto en el pedido (la fila cambia de color)
        CRÍTICO   → queda poco stock. Tocado otra vez pasa a SIN STOCK
                    y otra vez más se borra (encontraste mercadería).
        SIN STOCK → se pone solo cuando entregás menos de lo pedido.
      CRÍTICO y SIN STOCK van a la "Lista de compras", que se descarga
      como archivo (Producto;Estado) para pegar en el Excel.
   5. Como es el carrito, podés cerrar la hoja y seguir agregando
      productos desde el catálogo (lo que el cliente se olvidó).
   6. "Enviar al cliente" arma el ticket final con los faltantes, el
      alias y el aviso de entrega, abre el menú de compartir y da el
      pedido por terminado (queda todo listo para el próximo).
      "Descartar" tira un pedido sin mandarlo.

   Precios: siempre los de la app (si el cliente editó el mensaje, no
   importa). Si el ticket dice "🔥 Oferta 02/11" y ese día el producto
   tenía esa oferta, se respeta aunque lo armes otro día.

   Sin servidor: el armado y la lista de compras se guardan en este
   celular. No descuenta stock para los demás clientes.

   Se carga ANTES de app.js (app.js usa esLineaArmado y precioArmado al
   abrir) y arma la pantalla cuando la página terminó de cargar.
   ========================================================= */

const ARMADO_KEY = "armado";
const LISTA_COMPRAS_KEY = "listaCompras";

// { inicio, lineas: { [id]: linea }, noReconocidas: [texto] }
let armado = null;
try {
  armado = JSON.parse(localStorage.getItem(ARMADO_KEY)) || null;
} catch (error) {
  armado = null;
}

function armadoActivo() {
  return Boolean(armado);
}

function esLineaArmado(id) {
  return Boolean(armado && armado.lineas && armado.lineas[String(id)]);
}

// Precio por unidad fijado al cargar el pedido (o null si no es del pedido)
function precioArmado(product) {
  if (!armado) return null;
  const linea = armado.lineas[String(product.Id)];
  return linea && typeof linea.precio === "number" ? linea.precio : null;
}

function guardarArmado() {
  try {
    if (armado) localStorage.setItem(ARMADO_KEY, JSON.stringify(armado));
    else localStorage.removeItem(ARMADO_KEY);
  } catch (error) {
    // Sin almacenamiento: sigue funcionando hasta cerrar la app
  }
}


(function () {

  const TEXTOS = Object.assign({
    titulo: "✅ *PEDIDO ARMADO*",
    intro: "¡Hola! Tu pedido ya está listo:",
    faltantes: "Esta vez no teníamos:",
    transferencia: "Si querés pagar por transferencia, el alias es *{alias}* (a nombre de {titular}).",
    cierre: "En un ratito te lo estamos llevando. Te confirmamos bien el horario."
  }, (typeof CLIENTE !== "undefined" && CLIENTE.armado) || {});

  const ESTADOS = { critico: "CRÍTICO", sinstock: "SIN STOCK" };

  function nodo(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);
    if (clase) elemento.className = clase;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
  }

  function normalizarNombre(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/�/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function numeroDePesos(texto) {
    const limpio = String(texto || "").replace(/\./g, "").replace(",", ".");
    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : null;
  }


  /* ---------------- LEER EL TICKET ---------------- */
  // "• 2 × Ledesma azucar blanca 1kg ($ 1.599)"
  // "• 2 bultos (20 u.) × Natura aceite 900cc ($ 1.990 c/u)"
  // "• 3 × De la Huerta pure tomate 520g (🔥 Oferta 02/11 · $ 840 (antes $ 999))"

  let porNombre = null;
  function productosPorNombre() {
    if (porNombre) return porNombre;
    porNombre = new Map();
    products.forEach(product => {
      if (tipoMuestra(product) !== "producto") return;
      const clave = normalizarNombre(product.name);
      if (clave && !porNombre.has(clave)) porNombre.set(clave, product);
    });
    return porNombre;
  }

  // Busca el nombre del producto al principio del texto: prueba cortando
  // en cada " (" (el precio va entre paréntesis después del nombre)
  function buscarProducto(resto) {
    const mapa = productosPorNombre();
    let posicion = resto.indexOf(" (");
    while (posicion !== -1) {
      const producto = mapa.get(normalizarNombre(resto.slice(0, posicion)));
      if (producto) return { producto, detalle: resto.slice(posicion + 2) };
      posicion = resto.indexOf(" (", posicion + 2);
    }
    const producto = mapa.get(normalizarNombre(resto));
    return producto ? { producto, detalle: "" } : null;
  }

  // ¿El producto tenía esa oferta ese día? ("02/11" → FechaOferta 2026-11-02)
  function ofertaDelDia(product, diaMes) {
    if (!diaMes) return null;
    const [dia, mes] = diaMes.split("/");
    const fecha = String(product.FechaOferta || "");
    const precio = Number(product.PrecioOferta);
    if (!fecha.endsWith(`-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`)) return null;
    if (!(precio > 0) || !(precio < Number(product.price))) return null;
    return { fecha: diaMes, precio, antes: Number(product.price) };
  }

  function leerRenglon(renglon) {
    const texto = renglon.replace(/^[\s•\-\*·]+/, "").trim();
    const separador = texto.match(/\s[×x]\s/);
    if (!separador) return null;
    const cantidadTexto = texto.slice(0, separador.index).trim();
    const resto = texto.slice(separador.index + separador[0].length).trim();

    const encontrado = buscarProducto(resto);
    if (!encontrado) return { error: texto };

    let unidades, pasos = null, medidaTexto = null;
    const conMedida = cantidadTexto.match(/^(\d+)\s+(.+?)\s*\((\d+)\s*u\.?\)/i);
    if (conMedida) {
      pasos = Number(conMedida[1]);
      medidaTexto = conMedida[2].trim().toLowerCase();
      unidades = Number(conMedida[3]);
    } else if (/^\d+$/.test(cantidadTexto)) {
      unidades = Number(cantidadTexto);
    } else {
      return { error: texto };
    }
    if (!(unidades > 0)) return { error: texto };

    const diaOferta = (encontrado.detalle.match(/Oferta\s+(\d{1,2}\/\d{1,2})/i) || [])[1] || null;
    const precioTicket = numeroDePesos((encontrado.detalle.match(/\$\s*([\d.,]+)/) || [])[1]);

    return { producto: encontrado.producto, unidades, pasos, medidaTexto, diaOferta, precioTicket };
  }

  // Precio y forma con los datos de la app (no los del mensaje)
  function armarLinea(dato) {
    const product = dato.producto;
    const formas = formasDeCompra(product);
    const oferta = ofertaDelDia(product, dato.diaOferta);

    let forma = formas[0];
    if (!oferta && formas[1] && dato.unidades >= unidadesMinimas(formas[1])) forma = formas[1];

    // Medida para mostrar "1 bulto + 5 u.": la del ticket, o la de la forma
    let medida = null, porPaso = 1;
    if (dato.pasos) {
      porPaso = Math.max(1, Math.round(dato.unidades / dato.pasos));
      const conocida = formas.find(f => pluralizar(f.medida, dato.pasos) === dato.medidaTexto || f.medida === dato.medidaTexto);
      medida = conocida ? conocida.medida : dato.medidaTexto.replace(/(es|s)$/, "");
    } else if (formaConMedida(forma)) {
      medida = forma.medida;
      porPaso = forma.unidadesPorPaso;
    }

    return {
      pedidas: dato.unidades,
      forma: forma.numero,
      precio: oferta ? oferta.precio : forma.precioUnitario,
      oferta: oferta || (forma.oferta && forma.oferta.tipo === "hoy" ? { fecha: fechaCortaOferta(forma.oferta.fecha), antes: forma.oferta.antes } : null),
      precioTicket: dato.precioTicket,
      medida,
      porPaso,
      hecho: false,
      estado: "",
      estadoAuto: false
    };
  }

  function cargarPedido(texto) {
    const lineas = {};
    const noReconocidas = [];
    String(texto || "").split(/\r?\n/).forEach(renglon => {
      if (!/\s[×x]\s/.test(renglon)) return;
      const dato = leerRenglon(renglon);
      if (!dato) return;
      if (dato.error) {
        noReconocidas.push(dato.error);
        return;
      }
      const id = idProducto(dato.producto);
      if (lineas[id]) {
        // El mismo producto dos veces: se suman
        lineas[id].pedidas += dato.unidades;
        return;
      }
      lineas[id] = armarLinea(dato);
    });

    if (Object.keys(lineas).length === 0) return false;

    // El carrito del celular pasa a ser este pedido
    Object.keys(cart).forEach(id => quitarDelCarrito(id));
    Object.entries(lineas).forEach(([id, linea]) => {
      cart[id] = linea.pedidas;
      if (linea.forma === 2) cartOpcion[id] = 2;
    });

    armado = { inicio: new Date().toISOString(), lineas, noReconocidas };
    guardarArmado();
    despuesDeCambiar();
    return true;
  }


  /* ---------------- CANTIDADES Y ESTADOS ---------------- */

  function lineaDe(id) {
    if (!armado) return null;
    if (!armado.lineas[id]) {
      // Agregado desde el catálogo durante el armado
      const product = productoPorId(id);
      const forma = formaEnCarrito(product);
      armado.lineas[id] = {
        pedidas: null,
        agregado: true,
        forma: forma.numero,
        precio: null,                 // precio normal del carrito
        medida: formaConMedida(forma) ? forma.medida : null,
        porPaso: formaConMedida(forma) ? forma.unidadesPorPaso : 1,
        hecho: false,
        estado: "",
        estadoAuto: false
      };
    }
    return armado.lineas[id];
  }

  // "1 bulto + 5 u.", "2 bultos", "15 u."
  function textoUnidades(linea, unidades) {
    if (!linea.medida || linea.porPaso <= 1) return `${unidades} u.`;
    const pasos = Math.floor(unidades / linea.porPaso);
    const resto = unidades % linea.porPaso;
    const partes = [];
    if (pasos > 0) partes.push(`${pasos} ${pluralizar(linea.medida, pasos)}`);
    if (resto > 0 || pasos === 0) partes.push(`${resto} u.`);
    return partes.join(" + ");
  }

  function precioDe(id) {
    const product = productoPorId(id);
    return precioUnitarioEnCarrito(product);
  }

  function cambiarEntrega(id, sentido) {
    const linea = lineaDe(id);
    cart[id] = Math.max(0, (Number(cart[id]) || 0) + sentido);

    // Entregás menos de lo pedido → SIN STOCK solo. Si volvés a lo pedido, se borra.
    if (linea.pedidas !== null) {
      if (cart[id] < linea.pedidas) {
        if (!linea.estado || linea.estadoAuto) {
          linea.estado = "sinstock";
          linea.estadoAuto = true;
        }
      } else if (linea.estadoAuto) {
        linea.estado = "";
        linea.estadoAuto = false;
      }
    }
    actualizarListaCompras(id, linea);
    despuesDeCambiar();
  }

  // CRÍTICO → SIN STOCK → nada
  function alternarEstado(id) {
    const linea = lineaDe(id);
    linea.estado = linea.estado === "" ? "critico" : linea.estado === "critico" ? "sinstock" : "";
    linea.estadoAuto = false;
    actualizarListaCompras(id, linea);
    guardarArmado();
    dibujar();
  }

  function alternarHecho(id) {
    const linea = lineaDe(id);
    linea.hecho = !linea.hecho;
    abiertas.delete(id);   // al marcarlo HECHO se achica (queda solo el nombre)
    guardarArmado();
    dibujar();
  }

  function quitarAgregado(id) {
    quitarDelCarrito(id);
    if (armado) delete armado.lineas[id];
    despuesDeCambiar();
  }

  function despuesDeCambiar() {
    guardarArmado();
    saveCart();
    updateWhatsAppLink();
    updateCheckoutUI();
    // Las tarjetas del catálogo muestran la cantidad nueva
    document.querySelectorAll(".productCard[data-product-id]").forEach(tarjeta => {
      const product = productoPorId(tarjeta.dataset.productId);
      if (!product || tarjeta.classList.contains("posterCard")) return;
      updateCardControls(tarjeta, product, true);
      actualizarFormasDeCompra(tarjeta, product, false);
    });
    dibujar();
  }


  /* ---------------- LISTA DE COMPRAS ---------------- */
  // { [id]: { producto, estado } } — se acumula entre pedidos hasta vaciarla

  function leerLista() {
    try {
      return JSON.parse(localStorage.getItem(LISTA_COMPRAS_KEY)) || {};
    } catch (error) {
      return {};
    }
  }

  function guardarLista(lista) {
    try {
      localStorage.setItem(LISTA_COMPRAS_KEY, JSON.stringify(lista));
    } catch (error) { /* sin almacenamiento */ }
  }

  function actualizarListaCompras(id, linea) {
    const lista = leerLista();
    const product = productoPorId(id);
    if (linea.estado) {
      lista[id] = { producto: product ? product.name : id, estado: ESTADOS[linea.estado] };
    } else {
      delete lista[id];
    }
    guardarLista(lista);
  }

  function cantidadEnLista() {
    return Object.keys(leerLista()).length;
  }

  function descargarLista() {
    const lista = leerLista();
    const filas = Object.entries(lista)
      .sort(([a, x], [b, y]) =>
        (x.estado === y.estado ? 0 : x.estado === ESTADOS.sinstock ? -1 : 1) ||
        ((posicionEnCatalogo.get(a) ?? 0) - (posicionEnCatalogo.get(b) ?? 0)))
      .map(([, item]) => `${String(item.producto).replace(/;/g, ",")};${item.estado}`);
    if (filas.length === 0) return;

    const contenido = "﻿" + ["Producto;Estado", ...filas].join("\r\n") + "\r\n";
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `lista-compras-${fechaDeHoy()}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    setTimeout(() => {
      URL.revokeObjectURL(enlace.href);
      enlace.remove();
    }, 1000);
  }

  function vaciarLista() {
    guardarLista({});
    dibujar();
  }


  /* ---------------- TICKET PARA EL CLIENTE ---------------- */

  // Lo del carrito y lo del pedido (aunque se haya quitado desde el catálogo)
  function idsEnOrden() {
    const ids = new Set(Object.keys(cart));
    if (armado) Object.keys(armado.lineas).forEach(id => {
      if (!armado.lineas[id].agregado && productoPorId(id)) ids.add(id);
    });
    return [...ids].sort((a, b) =>
      (posicionEnCatalogo.get(a) ?? Infinity) - (posicionEnCatalogo.get(b) ?? Infinity));
  }

  function totalArmado() {
    return idsEnOrden().reduce((total, id) => total + precioDe(id) * (Number(cart[id]) || 0), 0);
  }

  function textoTicket() {
    let texto = `${TEXTOS.titulo}\n\n${TEXTOS.intro}\n\n`;
    let articulos = 0;
    const faltantes = [];

    idsEnOrden().forEach(id => {
      const product = productoPorId(id);
      const linea = lineaDe(id);
      const unidades = Number(cart[id]) || 0;
      const precio = precioDe(id);

      if (linea.pedidas !== null && unidades < linea.pedidas) {
        faltantes.push(unidades === 0
          ? `• ${product.name} (pediste ${textoUnidades(linea, linea.pedidas)})`
          : `• ${product.name}: ${linea.pedidas - unidades === 1 ? "faltó" : "faltaron"} ${textoUnidades(linea, linea.pedidas - unidades)}`);
      }
      if (unidades === 0) return;

      articulos += unidades;
      const cantidad = linea.medida && linea.porPaso > 1
        ? `${textoUnidades(linea, unidades)} (${unidades} u.)`
        : String(unidades);
      const conOferta = linea.oferta ? ` · 🔥 Oferta ${linea.oferta.fecha}` : "";
      const sufijo = linea.medida && linea.porPaso > 1 ? " c/u" : "";
      texto += `• ${cantidad} × ${product.name} (${formatter.format(precio)}${sufijo}${conOferta})\n`;
    });

    if (faltantes.length) texto += `\n${TEXTOS.faltantes}\n${faltantes.join("\n")}\n`;

    texto += `\n────────────────────\n`;
    texto += `💰 *TOTAL: ${formatter.format(roundToHundreds(totalArmado()))} (${articulos} ${articulos === 1 ? "artículo" : "artículos"})*\n`;

    const alias = (CLIENTE.pedido && CLIENTE.pedido.alias) || "";
    const titular = (CLIENTE.pedido && CLIENTE.pedido.titular) || "";
    if (alias && TEXTOS.transferencia) {
      let renglon = TEXTOS.transferencia.replace("{alias}", alias);
      // Sin titular cargado, se saca "(a nombre de …)"
      renglon = titular ? renglon.replace("{titular}", titular) : renglon.replace(/\s*\([^()]*\{titular\}[^()]*\)/, "").replace("{titular}", "");
      texto += `\n${renglon}`;
    }
    if (TEXTOS.cierre) texto += `\n${TEXTOS.cierre}`;
    return texto;
  }

  // Enviar = pedido terminado: se vacía el armado y el carrito, listo
  // para el próximo. Si se cierra el menú sin elegir chat, no se termina
  // (el ticket queda copiado y el pedido sigue armado).
  async function enviarAlCliente() {
    const texto = textoTicket();
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(texto).catch(() => {});
    if (navigator.share) {
      try {
        await navigator.share({ text: texto });
        terminar(true);
        return;
      } catch (error) {
        if (error && error.name === "AbortError") {
          mostrarAvisoCarrito(["No se envió. El ticket quedó copiado y el pedido sigue armado."], "Ticket copiado");
          return;
        }
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
    terminar(true);
  }

  function terminar(enviado) {
    armado = null;
    guardarArmado();
    Object.keys(cart).forEach(id => quitarDelCarrito(id));
    saveCart();
    updateWhatsAppLink();
    updateCheckoutUI();
    handleFilterPipeline();
    cerrar();
    if (enviado) {
      mostrarAvisoCarrito(["El ticket quedó copiado por si lo necesitás. Listo para armar el próximo."], "✓ Pedido enviado");
    }
  }


  /* ---------------- PANTALLA ---------------- */

  let velo = null;
  let confirmando = "";   // "terminar", "vaciar" o "enviar": segundo toque para confirmar
  const abiertas = new Set();   // productos HECHO que se abrieron para corregir algo

  function pendientes() {
    return idsEnOrden().filter(id => !lineaDe(id).hecho);
  }

  // Antes de mandar el ticket: todos los productos tienen que estar HECHO.
  // Si falta alguno se marcan en rojo y hay que tocar otra vez para mandar igual.
  function tocarEnviar() {
    const faltan = pendientes();
    if (faltan.length === 0 || confirmando === "enviar") {
      confirmando = "";
      enviarAlCliente();
      return;
    }
    confirmando = "enviar";
    dibujar();
    const primera = velo && velo.querySelector(".armadoFila.pendiente");
    if (primera) primera.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function construir() {
    velo = nodo("div", "armadoVelo");
    velo.hidden = true;
    velo.innerHTML = `
      <section class="armadoHoja" role="dialog" aria-modal="true" aria-label="Armar pedido" tabindex="-1">
        <header class="armadoEncabezado">
          <h2>📦 Armar pedido</h2>
          <button type="button" class="armadoCerrar" aria-label="Cerrar">✕</button>
        </header>
        <div class="armadoCuerpo"></div>
        <footer class="armadoPie"></footer>
      </section>`;
    velo.querySelector(".armadoCerrar").onclick = cerrar;
    velo.addEventListener("click", evento => {
      if (evento.target === velo) cerrar();
    });
    document.addEventListener("keydown", evento => {
      if (evento.key === "Escape" && velo && !velo.hidden) cerrar();
    });
    document.body.appendChild(velo);
  }

  function abrir() {
    if (!velo) construir();
    confirmando = "";
    abiertas.clear();
    dibujar();
    velo.hidden = false;
    document.body.classList.add("pedidoAbierto");
    requestAnimationFrame(() => requestAnimationFrame(() => velo.classList.add("visible")));
  }

  function cerrar() {
    if (!velo || velo.hidden) return;
    velo.classList.remove("visible");
    document.body.classList.remove("pedidoAbierto");
    setTimeout(() => {
      if (!velo.classList.contains("visible")) velo.hidden = true;
    }, 350);
  }

  function boton(clase, texto, alTocar) {
    const elemento = nodo("button", clase, texto);
    elemento.type = "button";
    elemento.onclick = alTocar;
    return elemento;
  }

  function dibujar() {
    actualizarPie();
    if (!velo) return;
    const cuerpo = velo.querySelector(".armadoCuerpo");
    const pie = velo.querySelector(".armadoPie");
    cuerpo.replaceChildren();
    pie.replaceChildren();

    if (!armado) {
      dibujarCargar(cuerpo, pie);
      return;
    }

    // Resumen
    const ids = idsEnOrden();
    const hechos = ids.filter(id => lineaDe(id).hecho).length;
    const faltan = ids.length - hechos;
    if (confirmando === "enviar" && faltan === 0) confirmando = "";
    cuerpo.appendChild(nodo("p", "armadoResumen",
      `${ids.length} productos · ${hechos} hechos · cargado ${new Date(armado.inicio).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`));

    if (armado.noReconocidas && armado.noReconocidas.length) {
      const caja = nodo("div", "armadoNoReconocidas");
      caja.appendChild(nodo("strong", "", "No reconocí estos renglones (agregalos desde el catálogo):"));
      armado.noReconocidas.forEach(texto => caja.appendChild(nodo("span", "", texto)));
      cuerpo.appendChild(caja);
    }

    const lista = nodo("ul", "armadoLista");
    ids.forEach(id => lista.appendChild(crearFila(id)));
    cuerpo.appendChild(lista);

    // Pie: total y botones
    const total = nodo("div", "armadoTotal");
    total.append(nodo("span", "", "Total"), nodo("strong", "", formatter.format(roundToHundreds(totalArmado()))));
    pie.appendChild(total);

    if (confirmando === "enviar") {
      pie.appendChild(nodo("p", "armadoFaltanHecho",
        `⚠️ ${faltan === 1 ? "Falta 1 producto" : `Faltan ${faltan} productos`} sin marcar HECHO (en rojo).`));
    }
    pie.appendChild(boton(`armadoEnviar${confirmando === "enviar" ? " igual" : ""}`,
      confirmando === "enviar" ? "Enviar igual (tocá de nuevo)" : "Enviar al cliente",
      tocarEnviar));

    const fila = nodo("div", "armadoBotones");
    fila.appendChild(boton("armadoSecundario", "＋ Agregar productos", cerrar));
    fila.appendChild(botonLista());
    // Solo para tirar un pedido sin mandarlo (ej. se pegó el mensaje equivocado)
    fila.appendChild(boton("armadoSecundario armadoTerminar",
      confirmando === "terminar" ? "¿Seguro? Tocá de nuevo" : "Descartar",
      () => {
        if (confirmando === "terminar") terminar(false);
        else { confirmando = "terminar"; dibujar(); }
      }));
    pie.appendChild(fila);
  }

  function botonLista() {
    const cantidad = cantidadEnLista();
    const elemento = boton("armadoSecundario armadoLista-boton", `⬇ Lista de compras (${cantidad})`, descargarLista);
    elemento.disabled = cantidad === 0;
    return elemento;
  }

  function dibujarCargar(cuerpo, pie) {
    cuerpo.appendChild(nodo("p", "armadoAyuda",
      "Copiá en WhatsApp el mensaje del pedido del cliente y tocá «Pegar pedido». Si no se pega solo, pegalo en el cuadro."));
    const area = nodo("textarea", "armadoTexto");
    area.placeholder = "Pegá acá el pedido…";
    area.rows = 7;
    cuerpo.appendChild(area);
    const aviso = nodo("p", "armadoAviso");
    aviso.hidden = true;
    cuerpo.appendChild(aviso);

    const cargar = texto => {
      if (cargarPedido(texto)) {
        confirmando = "";
        dibujar();
      } else {
        aviso.textContent = "No encontré productos en ese texto. Fijate de copiar el mensaje completo del pedido.";
        aviso.hidden = false;
      }
    };

    pie.appendChild(boton("armadoEnviar", "📋 Pegar pedido", async () => {
      if (area.value.trim()) {
        cargar(area.value);
        return;
      }
      try {
        const texto = await navigator.clipboard.readText();
        area.value = texto;
        cargar(texto);
      } catch (error) {
        aviso.textContent = "No pude leer lo copiado. Mantené apretado el cuadro, tocá «Pegar» y después «Pegar pedido».";
        aviso.hidden = false;
        area.focus();
      }
    }));

    const fila = nodo("div", "armadoBotones");
    fila.appendChild(botonLista());
    fila.appendChild(boton("armadoSecundario",
      confirmando === "vaciar" ? "¿Seguro? Tocá de nuevo" : "Vaciar lista",
      () => {
        if (confirmando === "vaciar") { confirmando = ""; vaciarLista(); }
        else { confirmando = "vaciar"; dibujar(); }
      }));
    pie.appendChild(fila);
  }

  function crearFila(id) {
    const product = productoPorId(id);
    const linea = lineaDe(id);
    const unidades = Number(cart[id]) || 0;
    const precio = precioDe(id);

    const fila = nodo("li", "armadoFila");
    if (linea.hecho) fila.classList.add("hecho");
    if (linea.estado) fila.classList.add(`estado-${linea.estado}`);
    if (!linea.hecho && confirmando === "enviar") fila.classList.add("pendiente");

    // HECHO: solo el nombre. Tocándolo se abre para corregir algo.
    if (linea.hecho && !abiertas.has(id)) {
      fila.classList.add("cerrada");
      const abrirFila = boton("armadoFilaAbrir", "", () => {
        abiertas.add(id);
        dibujar();
      });
      abrirFila.append(nodo("span", "armadoCheck", "✓"), nodo("span", "armadoNombre", product.name));
      abrirFila.setAttribute("aria-label", `${product.name}: hecho. Tocá para ver o corregir`);
      fila.appendChild(abrirFila);
      return fila;
    }

    const foto = nodo("img", "armadoFoto");
    foto.src = product.image || categoryImage(product.category);
    foto.alt = "";
    foto.loading = "lazy";
    foto.onerror = () => {
      foto.onerror = null;
      foto.src = categoryImage(product.category);
    };

    const info = nodo("div", "armadoInfo");
    const nombre = nodo("span", "armadoNombre", product.name);
    if (linea.hecho) {
      // Abierta para corregir: tocando el nombre se vuelve a achicar
      nombre.classList.add("tocable");
      nombre.title = "Tocá para achicar";
      nombre.onclick = () => {
        abiertas.delete(id);
        dibujar();
      };
    }
    info.appendChild(nombre);
    const pidio = linea.pedidas !== null
      ? `Pidió ${textoUnidades(linea, linea.pedidas)}${linea.medida && linea.porPaso > 1 ? ` (${linea.pedidas} u.)` : ""}`
      : "Agregado";
    const detalle = nodo("span", "armadoDetalle", `${pidio} · ${formatter.format(precio)} c/u`);
    if (linea.oferta) detalle.append(nodo("span", "armadoOferta", ` 🔥 Oferta ${linea.oferta.fecha}`));
    info.appendChild(detalle);
    if (linea.precioTicket && Math.abs(linea.precioTicket - precio) >= 1) {
      info.appendChild(nodo("span", "armadoTicket", `El ticket decía ${formatter.format(linea.precioTicket)}: va el precio de la app`));
    }

    const subtotal = nodo("strong", "armadoSubtotal", formatter.format(precio * unidades));

    const entrega = nodo("div", "armadoEntrega");
    const menos = boton("armadoMenos", "−", () => cambiarEntrega(id, -1));
    menos.disabled = unidades === 0;
    menos.setAttribute("aria-label", `Una unidad menos de ${product.name}`);
    const mas = boton("armadoMas", "+", () => cambiarEntrega(id, +1));
    mas.setAttribute("aria-label", `Una unidad más de ${product.name}`);
    const cantidad = nodo("span", "armadoCantidad", `${unidades} u.`);
    entrega.append(menos, cantidad, mas);
    if (linea.medida && linea.porPaso > 1) entrega.appendChild(nodo("span", "armadoEquivale", `= ${textoUnidades(linea, unidades)}`));
    if (linea.pedidas !== null && unidades < linea.pedidas) {
      entrega.appendChild(nodo("span", "armadoFaltan", `Faltan ${linea.pedidas - unidades} u.`));
    }

    const estados = nodo("div", "armadoEstados");
    const hecho = boton(`armadoHecho${linea.hecho ? " activo" : ""}`, linea.hecho ? "✓ HECHO" : "HECHO", () => alternarHecho(id));
    hecho.setAttribute("aria-pressed", String(linea.hecho));
    const estado = boton(`armadoEstado${linea.estado ? ` ${linea.estado}` : ""}`,
      linea.estado ? ESTADOS[linea.estado] : "CRÍTICO", () => alternarEstado(id));
    estado.title = "Tocá para pasar a CRÍTICO, SIN STOCK o sacarlo";
    estados.append(hecho, estado);
    if (linea.agregado && unidades === 0) estados.appendChild(boton("armadoQuitar", "Quitar", () => quitarAgregado(id)));

    fila.append(foto, info, subtotal, entrega, estados);
    return fila;
  }

  // El pie "Ver pedido" del catálogo dice "Armando pedido"
  function actualizarPie() {
    const texto = document.querySelector("#checkoutBtn .orderText");
    if (texto) texto.textContent = armado ? "📦 Armando pedido" : "Ver pedido";
    const pie = document.getElementById("orderFooter");
    if (pie) pie.classList.toggle("modoArmado", Boolean(armado));
  }


  /* ---------------- ARRANQUE ---------------- */

  function iniciar() {
    if (typeof searchInput === "undefined" || !searchInput) return;

    // Palabra reservada (cliente/config.js → palabrasReservadas.armar, "order")
    searchInput.addEventListener("input", () => {
      if (!esPalabraReservada(searchInput.value, "armar")) return;
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.blur();
      abrir();
    });

    // Cualquier cambio del carrito (desde el catálogo) actualiza la hoja
    document.addEventListener("carritocambio", () => {
      if (!armado) return;
      // Productos que se quitaron del carrito desde el catálogo
      Object.keys(armado.lineas).forEach(id => {
        if (!(id in cart) && armado.lineas[id].agregado) delete armado.lineas[id];
      });
      guardarArmado();
      actualizarPie();
      if (velo && !velo.hidden) dibujar();
    });

    actualizarPie();
  }

  // Lo usa js/carrito.js: con un armado en curso, "Ver pedido" abre esta hoja
  window.abrirArmado = abrir;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();

})();
