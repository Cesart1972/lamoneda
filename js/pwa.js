/* =========================================================
   PWA.JS
   ---------------------------------------------------------
   1. Registra el service worker (instalación y modo offline).
   2. Actualiza el catálogo cuando el cliente vuelve a la app
      después de un rato en segundo plano.

   Reemplaza a las recargas forzadas que había antes (al entrar
   por primera vez en el día, al primer scroll y a la primera
   búsqueda). El carrito no se pierde: queda guardado en el
   celular.
   ========================================================= */


/* ---------------- 1. SERVICE WORKER ---------------- */

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .catch((error) => {
        console.warn("No se pudo registrar el service worker:", error);
      });
  });
}


/* ---------------- 2. ACTUALIZAR AL VOLVER ---------------- */

// Si la app estuvo en segundo plano más de este tiempo,
// al volver se recarga para traer precios y stock nuevos.
const PWA_TIEMPO_PARA_ACTUALIZAR = 60 * 60 * 1000; // 1 hora

let pwaOcultaDesde = null;

document.addEventListener("visibilitychange", () => {

  if (document.visibilityState === "hidden") {
    pwaOcultaDesde = Date.now();
    return;
  }

  if (
    pwaOcultaDesde !== null &&
    Date.now() - pwaOcultaDesde >= PWA_TIEMPO_PARA_ACTUALIZAR &&
    navigator.onLine
  ) {
    window.location.reload();
  }

  pwaOcultaDesde = null;
});


/* ---------------- LIMPIEZA DE CLAVES VIEJAS ---------------- */

// Claves que usaba el sistema anterior de recargas forzadas.
try {
  localStorage.removeItem("pwaLastRefreshTime");
  localStorage.removeItem("pwaLastRefreshDate");
  sessionStorage.removeItem("pwaScrollRefreshDone");
  sessionStorage.removeItem("pwaSearchRefreshDone");
} catch (e) {}
