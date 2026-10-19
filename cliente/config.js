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

    // Palabra que, escrita en el buscador, habilita enviar un pedido
    // por debajo del mínimo (ej. refacturación por faltantes).
    // Vale hasta cerrar la app.
    palabraEnviarIgual: "send",

    // Alias para transferencias (botón "Copiar" en la bienvenida)
    alias: "cesarmompo.mp"
  },


  /* ---------------- BIENVENIDA ---------------- */
  // Se muestra una vez por día y con el botón "Info" del encabezado.
  // Entre ** ** va en negrita. {empresa}, {compraMinima} y {alias} se completan solos.
  // Si un ítem tiene "alias: true", muestra el alias con el botón Copiar.

  bienvenida: {
    mostrar: true,
    imagen: "imagenes/La-Moneda-logo-removebg.webp",
    saludo: "¡Hola! 👋",
    titulo: "Bienvenido a {empresa}",
    intro: "Antes de arrancar, te respondo lo que siempre nos preguntan:",
    items: [
      { icono: "🏷️", pregunta: "¿Los precios son finales?", respuesta: "Sí, sin vueltas ni sorpresas." },
      { icono: "🚚", pregunta: "¿Cuándo me llega?", respuesta: "Si pedís antes de las 16 h, **te llega en el día.**" },
      { icono: "💸", pregunta: "¿Cómo pago?", respuesta: "Efectivo o transferencia.", alias: true },
      { icono: "🛒", pregunta: "¿Hay compra mínima?", respuesta: "Sí, de **{compraMinima}** en total." }
    ],
    cierre: "¡Desde la comodidad de tu casa o negocio comprá fácil, rápido y al mejor precio!",
    boton: "¡Vamos!",
    nota: "Lo volvés a ver cuando quieras tocando Info"
  },


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
      { imagen: "", icono: "🚚", titulo: "Entrega en el día", texto: "Pedí antes de las 16 h" },
      { imagen: "", icono: "🎁", titulo: "Envío sin cargo", texto: "Te lo llevamos gratis" },
      { imagen: "", icono: "💸", titulo: "Efectivo o transferencia", texto: "Pagá como te quede cómodo" },
      { imagen: "", icono: "📦", titulo: "Más cantidad, mejor precio", texto: "Mirá el precio por caja o bulto" }
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
