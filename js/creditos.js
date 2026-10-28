/* =========================================================
   CREDITOS.JS
   ---------------------------------------------------------
   "Diseñado y desarrollado por Ces.Art": link al WhatsApp de
   Ces.Art. Aparece al final del catálogo y al pie del cartel
   de Info (bienvenida).

   Es parte del programa (no de cliente/config.js), así es igual
   en todas las distribuidoras que usen la app.
   ========================================================= */

const CREDITOS = {
  texto: "Diseñado y desarrollado por",
  marca: "Ces.Art",
  whatsapp: "5491158021519",
  mensaje: "¡Hola Ces.Art! Vi la app de catálogo y quiero una para mi negocio."
};

function crearLinkCreditos(clase) {
  const link = document.createElement("a");
  link.className = `creditos ${clase || ""}`.trim();
  link.href = `https://wa.me/${CREDITOS.whatsapp}?text=${encodeURIComponent(CREDITOS.mensaje)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `${CREDITOS.texto} ${CREDITOS.marca}. Escribir por WhatsApp`);
  link.innerHTML = `
    <span class="creditosTexto"></span>
    <strong class="creditosMarca"></strong>
    <svg class="creditosFlecha" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>`;
  link.querySelector(".creditosTexto").textContent = CREDITOS.texto;
  link.querySelector(".creditosMarca").textContent = CREDITOS.marca;
  return link;
}

// Al final del catálogo (debajo del último producto)
(function () {
  const lista = document.getElementById("productGrid");
  if (!lista) return;
  const pie = document.createElement("footer");
  pie.className = "creditosPie";
  pie.appendChild(crearLinkCreditos());
  const vacio = document.getElementById("emptyState");
  (vacio || lista).after(pie);
})();
