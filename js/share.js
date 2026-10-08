/* =====================================================
   HACEMOS QUE ABRA EL MODAL DE COMPARTIR
   ===================================================== */

const btnCompartir = document.getElementById("btnCompartir");
const modalCompartir = document.getElementById("modalCompartir");
const cerrarCompartir = document.getElementById("cerrarCompartir");
const qrCompartir = document.getElementById("qrCompartir");
const btnCopiarLink = document.getElementById("btnCopiarLink");

const urlPWA = window.location.href;

// Abrimos el modal

btnCompartir.addEventListener("click", () => {

  modalCompartir.classList.add("activo");

  // Evitamos generar el QR varias veces
  if (!qrCompartir.hasChildNodes()) {

      new QRCode(qrCompartir, {
          text: urlPWA,
          width: 180,
          height: 180
      });

  }

});


// Cerramos el modal

cerrarCompartir.addEventListener("click", () => {
  modalCompartir.classList.remove("activo");
});

// Y también podemos permitir cerrar el modal tocando fuera

modalCompartir.addEventListener("click", (e) => {

  if (e.target === modalCompartir) {
      modalCompartir.classList.remove("activo");
  }

});

// El botón "Link para compartir"

btnCopiarLink.addEventListener("click", async () => {

  try {

      await navigator.clipboard.writeText(urlPWA);

      mostrarToast("¡Enlace copiado, listo para compartir!");

      modalCompartir.classList.remove("activo");

      setTimeout(() => {

          const mensaje = encodeURIComponent(
              "¡Mirá esta aplicación! " + urlPWA
          );

          window.open(
              `https://wa.me/?text=${mensaje}`,
              "_blank"
          );

      }, 700);

  } catch (error) {

      console.error("No se pudo copiar el enlace:", error);

      alert("No se pudo copiar el enlace.");

  }

});

// Mensaje de alerta de enlace copiado y listo para compartir

function mostrarToast(mensaje) {

  const toast = document.getElementById("toastCompartir");

  toast.textContent = mensaje;
  toast.classList.add("mostrar");

  setTimeout(() => {
      toast.classList.remove("mostrar");
  }, 1500);

}

// QR de compartir PWA

let modalSeAbrePorQR = false;

// Y podemos detectar cuando la PWA deja de estar visible

document.addEventListener("visibilitychange", () => {

  if (document.visibilityState === "hidden") {

      if (modalCompartir.classList.contains("activo")) {
          modalSeAbrePorQR = true;
      }

  }

});

// Cuando vuelve a estar visible

document.addEventListener("visibilitychange", () => {

  if (
      document.visibilityState === "visible" &&
      modalSeAbrePorQR
  ) {

      modalCompartir.classList.remove("activo");

      modalSeAbrePorQR = false;
  }

});