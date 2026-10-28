/* =========================================================
   SERVICE WORKER
   ---------------------------------------------------------
   Permite instalar la PWA y usarla sin conexión.

   Estrategias:
   - Código y datos (HTML, JS, CSS, JSON, products-data.js):
     RED PRIMERO. Si hay internet, siempre se usa la versión
     más nueva del servidor (precios y stock al día). Si no
     hay internet o tarda demasiado, se usa la última copia
     guardada.
   - Imágenes y archivos externos (QR):
     Se muestra la copia guardada al instante y se actualiza
     en segundo plano. Si reemplazás una foto con el mismo
     nombre, se ve en la siguiente visita.

   IMPORTANTE: para cambiar precios, productos, la
   configuración del cliente o el código NO hace falta tocar
   este archivo. Solo cambiá CACHE_VERSION
   si modificás la lógica de este archivo o la lista
   PRECACHE_URLS.
   ========================================================= */

const CACHE_VERSION = "v16";
const CACHE_APP = `app-${CACHE_VERSION}`;
const CACHE_IMAGES = `imagenes-${CACHE_VERSION}`;

// Tiempo máximo de espera de la red antes de usar la copia guardada
const NETWORK_TIMEOUT_MS = 5000;

// Archivos que se guardan apenas se instala la PWA
const PRECACHE_URLS = [
  "./",
  "index.html",
  "cliente/config.js",
  "cliente/manifest.json",
  "js/cliente.js",
  "styles.css",
  "css/header.css",
  "css/theme.css",
  "products-data.js",
  "js/datos.js",
  "js/ofertas.js",
  "js/carrusel-ofertas.js",
  "css/ofertas.css",
  "js/favoritos.js",
  "js/search-engine-v1.js",
  "js/formas-compra.js",
  "app.js",
  "voiceSearch.js",
  "js/share.js",
  "js/creditos.js",
  "js/bienvenida.js",
  "js/carrito.js",
  "css/carrito.css",
  "css/chips.css",
  "css/botones.css",
  "js/chips.js",
  "css/bienvenida.css",
  "js/pwa.js",
  "cliente/icons/icon-192.png",
  "cliente/icons/icon-512.png"
];

// Logo y favicon del cliente (se leen de cliente/config.js)
try {
  importScripts("cliente/config.js");
  [CLIENTE.empresa.logo, CLIENTE.empresa.favicon]
    .filter(Boolean)
    .forEach((url) => PRECACHE_URLS.push(url));
} catch (error) {
  // Si no se puede leer la configuración, se sigue sin los logos.
}


/* ---------------- INSTALACIÓN ---------------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_APP).then((cache) =>
      // Se guardan uno por uno: si falta un archivo,
      // la instalación no se cae por eso.
      Promise.all(
        PRECACHE_URLS.map((url) =>
          fetch(url, { cache: "no-cache" })
            .then((response) => {
              if (response.ok) return cache.put(url, response);
            })
            .catch(() => {})
        )
      )
    )
  );
  self.skipWaiting();
});


/* ---------------- ACTIVACIÓN ---------------- */

self.addEventListener("activate", (event) => {
  const vigentes = [CACHE_APP, CACHE_IMAGES];

  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !vigentes.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});


/* ---------------- PEDIDOS ---------------- */

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  const mismoOrigen = url.origin === self.location.origin;

  if (mismoOrigen && esCodigoODatos(request, url)) {
    event.respondWith(redPrimero(event, request));
    return;
  }

  if (request.destination === "image" || !mismoOrigen) {
    event.respondWith(copiaYActualiza(event, request));
  }
});


function esCodigoODatos(request, url) {
  if (request.mode === "navigate") return true;
  return /\.(html|js|css|json)$/i.test(url.pathname) || url.pathname.endsWith("/");
}


/* Red primero, con copia de respaldo */

async function redPrimero(event, request) {
  const cache = await caches.open(CACHE_APP);

  // Para la página principal siempre se guarda/busca como "./"
  const claveCache =
    request.mode === "navigate" ? "./" : request;

  const pedidoRed = fetch(request, { cache: "no-cache" })
    .then((response) => {
      if (response && response.ok) {
        cache.put(claveCache, response.clone());
      }
      return response;
    });

  // Aunque se use la copia por timeout, la descarga sigue
  // y actualiza la copia para la próxima vez.
  event.waitUntil(pedidoRed.catch(() => {}));

  const copia = await cache.match(claveCache, { ignoreSearch: true });

  if (!copia) {
    // Nunca se guardó: no queda otra que esperar a la red.
    return pedidoRed;
  }

  const timeout = new Promise((resolve) =>
    setTimeout(() => resolve(copia), NETWORK_TIMEOUT_MS)
  );

  try {
    return await Promise.race([pedidoRed, timeout]);
  } catch (error) {
    // Sin conexión
    return copia;
  }
}


/* Copia guardada al instante + actualización en segundo plano */

async function copiaYActualiza(event, request) {
  const cache = await caches.open(CACHE_IMAGES);
  const copia = await cache.match(request);

  const pedidoRed = fetch(request)
    .then((response) => {
      // type "opaque" = archivo de otro sitio (ej. librería del QR)
      if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone());
      }
      return response;
    });

  if (copia) {
    event.waitUntil(pedidoRed.catch(() => {}));
    return copia;
  }

  return pedidoRed;
}
