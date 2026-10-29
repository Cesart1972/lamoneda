/* =========================================================
   CONFIGURACIÓN DEL CLIENTE
   ---------------------------------------------------------
   Este es el ÚNICO archivo que cambia entre una distribuidora
   y otra (junto con products-data.js, las imágenes y la
   carpeta cliente/icons).

   Para una distribuidora nueva:
   1. Copiá esta carpeta "cliente" completa.
   2. Cambiá los valores de este archivo.
   3. Reemplazá los íconos de cliente/icons por los del cliente
      (mismos nombres y medidas).
   4. Cambiá nombre y colores en cliente/manifest.json.

   No hace falta tocar ningún otro archivo del programa.
   ========================================================= */

const CLIENTE = {

  /* ---------------- EMPRESA ---------------- */

  empresa: {
    nombre: "La Moneda Mayorista",
    nombreCorto: "La Moneda",          // nombre debajo del ícono en el celular
    tituloCatalogo: "Catálogo",
    slogan: "Líderes en precios bajos",
    descripcion: "Catálogo digital",
    logo: "imagenes/La-Moneda-logo-removebg.webp",
    favicon: "imagenes/La-Moneda-logo.webp",
    idioma: "es-AR",
    moneda: "ARS"
  },


  /* ---------------- PANTALLA DE CARGA ---------------- */
  // Se ve mientras abre la app. "fondo" tiene que ser el mismo color que
  // "background_color" de cliente/manifest.json (la pantalla que muestra el
  // celular al abrir la app instalada), así no hay salto de color.

  carga: {
    fondo: "#F75101",                                  // naranja del ícono
    imagen: "imagenes/La-Moneda-logo-removebg.webp",   // logo sin fondo
    texto: "Cargando…"
  },


  /* ---------------- WHATSAPP ---------------- */

  whatsapp: {
    // Número con código de país, sin "+", espacios ni guiones
    numero: "5492346336888",

    // Nombre de quien recibe los pedidos (aparece en el saludo)
    nombreVendedor: "César"
  },


  /* ---------------- CONDICIONES DEL PEDIDO ---------------- */

  pedido: {
    // Monto mínimo para poder enviar el pedido (0 = sin mínimo)
    compraMinima: 30000,

    // Alias para transferencias (botón "Copiar" en la bienvenida)
    alias: "cesarmompo.mp"
  },


  /* ---------------- PALABRAS RESERVADAS ---------------- */
  // Escritas en el buscador, activan funciones para el vendedor.
  // Valen hasta cerrar la app. Conviene elegir palabras que un
  // cliente nunca escribiría. Vacío ("") = desactivada.

  palabrasReservadas: {
    // Muestra solo los productos sin stock (para ver qué reponer)
    quiebre: "quiebre",

    // Habilita el pedido aunque no llegue al mínimo (ej. refacturación
    // por faltantes). El botón de enviar copia el ticket armado y deja
    // elegir a qué contacto mandarlo (no lo manda a este WhatsApp).
    enviarIgual: "send",

    // Pone todos los productos sin stock como disponibles
    desbloquear: "unlock",

    // Arma las placas para redes (1080 × 1080) de las ofertas
    // "Solo x hoy" y las guarda en el celular (js/redes.js)
    redes: "redes"
  },


  /* ---------------- PLACAS PARA REDES ---------------- */
  // Se arman escribiendo palabrasReservadas.redes en el buscador.
  // Todo es opcional: si falta, se usa lo de "empresa" y "carga".

  redes: {
    cinta: "Solo x hoy!",                         // texto de la cinta
    textoEmpresa: "La Moneda mayorista",          // junto al logo, arriba a la derecha
    logo: "imagenes/La-Moneda-logo-removebg.webp",
    colorFondo: "#F75101"                         // color alrededor de la foto
  },


  /* ---------------- BIENVENIDA ---------------- */
  // Se muestra una vez por día y con el botón "Info" del encabezado.
  // Entre ** ** va en negrita. {empresa}, {compraMinima} y {alias} se completan solos.
  // Si un ítem tiene "alias: true", muestra el alias con el botón Copiar.
  // "icono" puede ser una imagen 3D (imagenes/iconos/…) o un emoji.

  bienvenida: {
    mostrar: true,
    imagen: "imagenes/La-Moneda-logo-removebg.webp",
    saludo: "¡Hola!",
    saludoIcono: "imagenes/iconos/saludo.svg",   // mano 3D que saluda (o vacío)
    titulo: "Bienvenido a {empresa}",
    intro: "Antes de arrancar, te respondo lo que siempre nos preguntan:",
    items: [
      { icono: "imagenes/iconos/precios.svg", pregunta: "¿Los precios son finales?", respuesta: "Sí, sin vueltas ni sorpresas." },
      { icono: "imagenes/iconos/entrega.svg", pregunta: "¿Cuándo me llega?", respuesta: "Si pedís antes de las 16 h, **te llega en el día.**" },
      { icono: "imagenes/iconos/pago.svg", pregunta: "¿Cómo pago?", respuesta: "Efectivo o transferencia." },
      { icono: "imagenes/iconos/compra-minima.svg", pregunta: "¿Hay compra mínima?", respuesta: "Sí, de **{compraMinima}** en total." }
    ],
    cierre: "¡Desde la **comodidad** de tu casa o negocio comprá **fácil**, **rápido** y al **mejor precio**!",
    boton: "¡Vamos!",
    nota: "Lo volvés a ver cuando quieras tocando Info"
  },


  /* ---------------- CHIPS (filtros rápidos debajo del buscador) ---------------- */
  // Se muestran en este orden. Un chip sin productos no aparece.
  //
  //   clave  → nombre interno, sin espacios ni tildes
  //   texto  → lo que lee el cliente
  //   icono  → imagen 3D (imagenes/chips/…, PNG/SVG con fondo transparente)
  //            o un emoji
  //   cintas → (opcional) productos con alguna de estas cintas entran solos
  //   categorias → (opcional) productos de estas categorías entran solos
  //   oferta → (opcional) "hoy": los que tienen la oferta "Solo x hoy"
  //            vigente · "rebaja": los que tienen rebaja permanente ·
  //            "todas": cualquiera de las dos (columnas FechaOferta y
  //            PrecioOferta del Excel). El chip aparece y desaparece solo.
  //
  // Los chips se combinan: Niños + Sin TACC muestra lo que está en los dos.
  //   especial: "favoritos" → los productos que el cliente marcó con el
  //            corazón o que ya compró (se guardan en su celular)
  //
  // Para poner un producto en un chip, en la columna keywords del Excel se
  // agrega #clave. Ej: "Marolio fideos #sintacc #ninos".
  // Esos productos muestran el ícono arriba a la derecha de la tarjeta.
  // "#hoy:2026-10-20" vale solo ese día (se sigue aceptando, pero ahora
  // "Solo x hoy" sale de FechaOferta + PrecioOferta).

  chips: [
    { clave: "hoy",         texto: "Solo x hoy",   icono: "imagenes/chips/hoy.svg", oferta: "hoy" },
    { clave: "liquidacion", texto: "Liquidación",  icono: "imagenes/chips/liquidacion.svg", cintas: ["Liquidación!"] },
    { clave: "ofertas",     texto: "Ofertas",      icono: "imagenes/chips/ofertas.svg", cintas: ["Preciazo!", "Al costo!", "2x1"], oferta: "rebaja" },
    { clave: "nuevos",      texto: "Nuevos",       icono: "imagenes/chips/nuevos.svg", cintas: ["Nuevo!", "Nueva!", "Nuevo sabor!"] },
    { clave: "masvendidos", texto: "Más vendidos", icono: "imagenes/chips/masvendidos.svg" },
    { clave: "ninos",       texto: "Niños",        icono: "imagenes/chips/ninos.svg" },
    { clave: "sintacc",     texto: "Sin TACC",     icono: "imagenes/chips/sintacc.svg" },
    { clave: "favoritos",   texto: "Favoritos",    icono: "imagenes/chips/favoritos.svg", especial: "favoritos" }
  ],


  /* ---------------- COMPRA POR GRUPO (en preparación) ---------------- */
  // Comprando varios productos de un mismo proveedor (supplier) hasta
  // llegar al monto mínimo, todos esos productos pasan a su
  // PrecioPorVolumen. Todavía no está activo en la app.
  //
  //   supplier    → tal como está en products-data.js (ej. "La Campechana")
  //   nombre      → lo que lee el cliente
  //   montoMinimo → monto a alcanzar sumando a precio normal
  //   orden       → orden en que se muestran los grupos
  //   icono       → imagen del grupo
  //   condiciones → texto que se muestra al tocar la etiqueta del grupo
  //
  // Ejemplo:
  //   { supplier: "La Campechana", nombre: "Combo La Campechana", montoMinimo: 50000,
  //     orden: 1, icono: "imagenes/chips/grupo.svg",
  //     condiciones: "Sumando $50.000 en productos La Campechana, pagás todos a precio por bulto." }

  comprasPorGrupo: [],


  /* ---------------- MENSAJES INSTITUCIONALES ---------------- */
  // Tapan los huecos que quedan en el catálogo antes de una categoría
  // nueva. Se van turnando en orden (con 4 a 6 mensajes alcanza).
  //
  // Cada mensaje puede tener:
  //   imagen → nombre del archivo dentro de "carpeta". Formato historia
  //            de Instagram (1080×1920), dejando márgenes sin texto
  //            arriba y abajo. Si hay imagen, se muestra la imagen.
  //   icono, titulo, texto → tarjeta naranja de texto. Se usa si no hay
  //            imagen o si la imagen no se encuentra.
  // {compraMinima} y {alias} se completan solos.
  // Si la lista queda vacía, se muestra el logo de la empresa.
  //
  // EJEMPLOS PROVISORIOS: reemplazalos por los mensajes reales.

  institucional: {
    carpeta: "imagenes/institucional/",
    mensajes: [
      { imagen: "", icono: "imagenes/iconos/entrega.svg", titulo: "Entrega en el día", texto: "Pedí antes de las 16 h" },
      { imagen: "", icono: "imagenes/iconos/envio-gratis.svg", titulo: "Envío sin cargo", texto: "Te lo llevamos gratis" },
      { imagen: "", icono: "imagenes/iconos/pago.svg", titulo: "Efectivo o transferencia", texto: "Pagá como te quede cómodo" },
      { imagen: "", icono: "imagenes/iconos/cantidad.svg", titulo: "Más cantidad, mejor precio", texto: "Mirá el precio por caja o bulto" }
    ]
  },


  /* ---------------- TEXTOS DE LOS MENSAJES ---------------- */
  // {vendedor} se reemplaza por whatsapp.nombreVendedor
  // {link} se reemplaza por el link del catálogo

  mensajes: {
    // Botón verde flotante (consulta sin pedido)
    consulta: "¡Hola! Estuve viendo tu lista de precios y quería hacerte una consulta.",

    // Encabezado del pedido
    tituloPedido: "🛒 *PEDIDO*",
    saludoPedido: "Hola {vendedor}.",
    introPedido: "Quiero realizar el siguiente pedido:",

    // Botón "Compartir" > "Link para compartir"
    compartir: "¡Mirá esta aplicación! {link}"
  },


  /* ---------------- COLORES ---------------- */
  // Formato hexadecimal: "#RRGGBB"

  colores: {
    principal: "#FFA500",    // fondo del encabezado y títulos destacados
    secundario: "#7F00FF",   // título del catálogo
    boton: "#0f766e",        // botón "Agregar", borde del buscador
    botonOscuro: "#0b5f59",  // precios, botón "Agregar" al tocarlo, + y −
    fondo: "#f4f6f5"         // fondo general de la página
  },


  /* ---------------- PRECIOS POR CANTIDAD ---------------- */
  // Se usan en los productos que tienen una segunda forma de compra
  // (columnas precio2, medida2, unidades2 y minimo2 de products-data.js).
  //
  // mostrarPrecioPor:
  //   "unidad" → el precio grande es por unidad individual ($689 c/u)
  //   "medida" → el precio grande es el de la caja/bulto completo ($8.268)
  //
  // Textos (las palabras entre llaves se completan solas):
  //   {ahorro}   → % de ahorro, resaltado en rojo
  //   {forma1}   → "unidad", "bulto"...
  //   {cantidad} → "1 caja", "5 bultos", "1 pallet"
  //
  // textoPregunta aparece si el cliente tiene cajas en el carrito y
  // toca "Unidad". Si responde que sí, queda en 1 unidad.

  precios: {
    mostrarPrecioPor: "unidad",
    textoAhorro: "Estás ahorrando {ahorro} frente a {forma1}",
    textoPregunta: "¿Querés comprar menos de {cantidad}?",
    textoPreguntaSi: "Sí, por {forma1}",
    textoPreguntaNo: "No"
  },


  /* ---------------- FILTROS AVANZADOS ---------------- */
  // "campo" = nombre de la columna en products-data.js
  // "titulo" = texto del botón
  // (El panel de filtros avanzados está desactivado por ahora.)

  filtros: [
    { campo: "category", titulo: "Categorías" },
    { campo: "brand",    titulo: "Marcas" }
  ],


  /* ---------------- IMAGEN DE RESPALDO POR CATEGORÍA ---------------- */
  // Se usa solo si un producto no tiene imagen.
  // CATEGORÍA (como está en products-data.js): [texto, color, fondo]
  // Las categorías que no estén acá usan un dibujo gris genérico.

  imagenRespaldo: {
    "GASEOSAS":           ["Gaseosas", "#dc2626", "#fee2e2"],
    "JUGOS":              ["Jugos",    "#ea580c", "#ffedd5"],
    "AGUAS Y SODAS":      ["Agua",     "#0284c7", "#e0f2fe"],
    "SNACKS":             ["Snacks",   "#ca8a04", "#fef9c3"],
    "CERVEZAS":           ["Cervezas", "#b45309", "#fef3c7"],
    "VINOS Y ESPUMANTES": ["Vinos",    "#9f1239", "#ffe4e6"],
    "LICORES":            ["Licores",  "#581c87", "#f3e8ff"],
    "VARIOS":             ["Varios",   "#0f766e", "#ccfbf1"]
  },


  /* ---------------- REGLAS DE BÚSQUEDA ---------------- */
  // "from" = lo que puede escribir o decir el cliente
  // "to"   = término correcto que debe buscar el motor
  // Sirven tanto para la búsqueda escrita como por voz.

  reglasBusqueda: [
    { from: "clay",       to: "clight" },
    { from: "clite",      to: "clight" },
    { from: "clai",       to: "clight" },
    { from: "gel mas",    to: "Hellman's" },
    { from: "zamora",     to: "savora" },
    { from: "lia",        to: "lima" },
    { from: "cbc",        to: "CBSe" },
    { from: "lives",      to: "Levex" },
    { from: "6m",         to: "Seiseme" },
    { from: "6 m",        to: "Seiseme" },
    { from: "acanaladas", to: "americanas" },
    { from: "labandina",  to: "lavandina" },
    { from: "multi",      to: "molto" },
    { from: "moto",       to: "molto" },
    { from: "cvc",        to: "cbse" },
    { from: "ruso",       to: "rollo" }
  ]

};
