/* =========================================================
   FORMAS-COMPRA.JS
   ---------------------------------------------------------
   Reglas de las formas de compra de cada producto
   (por unidad, por caja, por bulto, por pallet...).
   No dibuja nada en pantalla: solo calcula.

   Columnas de products-data.js que usa:

   Forma 1 (siempre existe)
     price     precio por unidad individual
     step      de a cuántas unidades se vende
     medida1   nombre de esa forma: "unidad" (o vacío), "bulto", "caja"...

   Forma 2 (opcional: si precio2 está vacío, no existe)
     precio2   precio por unidad individual comprando de esta forma
     medida2   "caja", "pack", "pallet", "bulto"...
     unidades2 unidades individuales que trae esa medida
     minimo2   cantidad mínima de esa medida (vacío = 1)

   El % de ahorro se calcula solo comparando price y precio2.
   Si precio2 está vacío pero hay medida2 y unidades2, la caja es un
   atajo para comprar más rápido, al mismo precio que la unidad.
   Si precio2 es mayor que price se toma como error (un solo precio).
   ========================================================= */


function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// caja → cajas, pack → packs, pallet → pallets, unidad → unidades
function pluralizar(palabra, cantidad) {
  if (cantidad === 1) return palabra;
  if (/[aeiouáéíóú]$/i.test(palabra)) return palabra + "s";   // caja → cajas
  if (/s$/i.test(palabra)) return palabra;                     // display multipack
  if (/z$/i.test(palabra)) return palabra.slice(0, -1) + "ces";
  if (/[dlrnj]$/i.test(palabra)) return palabra + "es";        // unidad → unidades
  return palabra + "s";                                        // pack → packs, pallet → pallets
}

function numeroPositivo(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function textoLimpio(valor) {
  return String(valor ?? "").trim().toLowerCase();
}


/* ---------------------------------------------------------
   FORMAS DE COMPRA DE UN PRODUCTO
   Devuelve una lista con 1 o 2 formas. Cada forma tiene:
     numero          1 o 2
     medida          "unidad", "caja", "bulto"...
     unidadesPorPaso unidades que suma cada toque de "+"
     minimoPasos     cuántos pasos como mínimo
     precioUnitario  precio por unidad individual
     corta           texto del interruptor ("Unidad", "Caja", "+20 cajas")
     etiqueta        texto completo ("Caja x12", "Pallet x80 bultos")
     columna         texto debajo del precio ("por unidad", "por caja 12u")
     mismoPrecio     la forma 2 cuesta lo mismo (solo es un atajo)
     ahorro          % de ahorro frente a la forma 1 (solo forma 2)
   --------------------------------------------------------- */

const cacheFormasDeCompra = new Map();

function formasDeCompra(product) {
  const clave = product;
  if (cacheFormasDeCompra.has(clave)) return cacheFormasDeCompra.get(clave);

  // Campos con nombre nuevo (o viejo, mientras no se actualice products-data.js)
  const valorMedida1 = campoProducto(product, "PresentacionVenta", "medida1");
  const valorPrecio2 = campoProducto(product, "PrecioPorVolumen", "precio2");
  const valorMedida2 = campoProducto(product, "PresentacionPorVolumen", "medida2");
  const valorUnidades2 = campoProducto(product, "UnidadesPorVolumen", "unidades2");
  const valorMinimo2 = campoProducto(product, "MinimoPorVolumen", "minimo2");

  const step = numeroPositivo(product.step) || 1;
  const medida1 = textoLimpio(valorMedida1) || "unidad";

  const forma1 = {
    numero: 1,
    medida: medida1,
    unidadesPorPaso: step,
    minimoPasos: 1,
    precioUnitario: Number(product.price) || 0
  };

  // Con oferta (Solo x hoy o rebaja, ver js/ofertas.js): se vende al
  // precio de oferta, con el step de price y sin la forma 2.
  const oferta = typeof ofertaDelProducto === "function" ? ofertaDelProducto(product) : null;
  if (oferta) {
    forma1.precioUnitario = oferta.precio;
    forma1.oferta = oferta;
  }

  if (medida1 === "unidad") {
    forma1.corta = "Unidad";
    forma1.etiqueta = step > 1 ? `x${step} u.` : "Unidad";
    forma1.columna = "por unidad";
  } else {
    forma1.corta = capitalizar(medida1);
    forma1.etiqueta = `${capitalizar(medida1)} x${step}`;
    forma1.columna = `por ${medida1} ${step}u`;
  }
  forma1.etiquetaMedida = forma1.etiqueta;

  const formas = [forma1];

  // Forma 2: necesita unidades2. Si precio2 está vacío (o es igual a price),
  // la caja es solo un atajo para comprar más rápido, al mismo precio.
  const unidades2 = numeroPositivo(valorUnidades2);
  let precio2 = numeroPositivo(valorPrecio2);

  if (oferta) {
    // Sin interruptor Unidad/Bulto mientras dure la oferta
  } else if (precio2 && precio2 > forma1.precioUnitario) {
    console.warn(
      `Producto ${product.Id}: precio2 (${precio2}) es mayor que price (${forma1.precioUnitario}). Se muestra solo un precio.`
    );
  } else if (
    unidades2 &&
    (unidades2 > step || (unidades2 === step && (numeroPositivo(valorMinimo2) || 1) > 1))
  ) {
    const medida2 = textoLimpio(valorMedida2) || medida1;
    const minimo2 = numeroPositivo(valorMinimo2) || 1;
    const mismaMedida = medida2 === medida1 && unidades2 === step;
    const mismoPrecio = !precio2 || precio2 === forma1.precioUnitario;
    if (mismoPrecio) precio2 = forma1.precioUnitario;

    const forma2 = {
      numero: 2,
      mismaMedida,
      mismoPrecio,
      medida: medida2,
      unidadesPorPaso: unidades2,
      minimoPasos: minimo2,
      precioUnitario: precio2,
      ahorro: !mismoPrecio && forma1.precioUnitario > 0
        ? Math.round((1 - precio2 / forma1.precioUnitario) * 100)
        : 0
    };

    if (medida2 === "unidad") {
      // Ej.: precio especial llevando 24 unidades o más
      forma2.corta = `x${unidades2}`;
      forma2.etiqueta = `x${unidades2} u.`;
      forma2.columna = `desde ${unidades2}u`;
    } else if (mismaMedida) {
      // Ej.: se vende por caja, y desde 20 cajas tiene otro precio
      forma2.corta = `+${minimo2} ${pluralizar(medida2, minimo2)}`;
      forma2.etiqueta = `Desde ${minimo2} ${pluralizar(medida2, minimo2)}`;
      forma2.columna = `desde ${minimo2} ${pluralizar(medida2, minimo2)}`;
    } else if (medida1 !== "unidad" && unidades2 % step === 0) {
      // Ej.: se vende por bulto, y el pallet trae 80 bultos
      const cantidadMedida1 = unidades2 / step;
      forma2.corta = capitalizar(medida2);
      forma2.etiqueta = `${capitalizar(medida2)} x${cantidadMedida1} ${pluralizar(medida1, cantidadMedida1)}`;
      forma2.columna = `por ${medida2} ${unidades2}u`;
    } else {
      // Ej.: se vende por unidad, y la caja trae 12
      forma2.corta = capitalizar(medida2);
      forma2.etiqueta = `${capitalizar(medida2)} x${unidades2}`;
      forma2.columna = `por ${medida2} ${unidades2}u`;
    }

    // Mismo precio: el botón dice "Caja x12u" y se muestra un solo precio
    if (mismoPrecio && medida2 !== "unidad" && !mismaMedida) {
      forma2.corta = `${capitalizar(medida2)} x${unidades2}u`;
      forma2.columna = forma2.corta;
    }

    forma2.etiquetaMedida = mismaMedida
      ? `${capitalizar(medida2)} x${unidades2}`
      : forma2.etiqueta;

    formas.push(forma2);
  } else if (valorPrecio2 || valorUnidades2) {
    console.warn(
      `Producto ${product.Id}: unidades2 debe ser mayor que step (o igual, con minimo2 mayor a 1). Se muestra solo un precio.`
    );
  }

  cacheFormasDeCompra.set(clave, formas);
  return formas;
}

function tieneDosFormas(product) {
  return formasDeCompra(product).length === 2;
}

// Forma de compra por número (si no existe la 2, devuelve la 1)
function formaDeCompra(product, numero) {
  const formas = formasDeCompra(product);
  return formas[numero - 1] || formas[0];
}

// ¿La forma se mide en algo distinto de unidades sueltas?
function formaConMedida(forma) {
  return forma.medida !== "unidad";
}

// Cantidad mínima en unidades individuales
function unidadesMinimas(forma) {
  return forma.unidadesPorPaso * forma.minimoPasos;
}


/* ---------------------------------------------------------
   TEXTOS DE CANTIDAD
   --------------------------------------------------------- */

// "2 cajas", "1 pallet", "24" (si se vende por unidad)
function textoCantidad(forma, unidades) {
  if (!formaConMedida(forma)) return String(unidades);
  const pasos = Math.round(unidades / forma.unidadesPorPaso);
  return `${pasos} ${pluralizar(forma.medida, pasos)}`;
}

// Para el mensaje de WhatsApp: "2 cajas (24 u.)" o "3"
function textoCantidadPedido(forma, unidades) {
  if (!formaConMedida(forma)) return String(unidades);
  return `${textoCantidad(forma, unidades)} (${unidades} u.)`;
}
