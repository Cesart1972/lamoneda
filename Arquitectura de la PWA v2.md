CAPITULOS
1. Filosofía del producto.
2. HTML.
3. CSS.
4. JavaScript.
5. Configuración.
6. Datos.
7. Roadmap.

Hasta ahora estuvimos haciendo programación. A partir de ahora vamos a hacer también diseño de producto.

Cada cambio que hagamos deberá cumplir tres condiciones:

✔ Debe mejorar la experiencia del comprador.
✔ Debe simplificar el mantenimiento del distribuidor.
✔ Debe servir para cualquier rubro.

Si una mejora no cumple esas tres condiciones, probablemente no entre en la versión comercial.

AUDITORÍA v2 - Capítulo 1

Filosofía del producto (principios)
1. La PWA no conoce el negocio del cliente.
 Nunca. El código no debe asumir que vende (alimentos,limpieza,autopartes,etc.).Todo eso proviene de los datos.

2. La PWA vende productos, no muestra productos.
 Hacer foco en:
        * orden del catálogo.
        * destacados.
        * banners.
        * promociones.
        * productos gancho.

 Todo tiene un objetivo: aumentar las ventas.

3. Mantenimiento en menos de cinco minutos.
 Un distribuidor no puede necesitar un programador.
 el mismo debe poder:
        * cambiar un precio.
        * agregar un producto.
        * sacar un producto.
        * reemplazar una foto.

4. Cero configuración técnica.
 Todo debe salir desde:
        * Access.
        * Excel.
        * products-data.js.
        * config.js.

5. Siempre rápido.
 Preferimos una función simple que tarda 20 ms, antes que una función espectacular que tarda 500 ms. Porque el usuario compra desde el celular.

6. Un único código fuente.
 No habrá una versión para alimentos, ferretería, repuestos. Habrá una sola PWA. Lo único que cambia serán los datos.

7. 
 📦 Producto (nombre, marca, sección, categoría, imagen).
💲 Venta (precio, promoción, múltiplo de compra, estado).
🏪 Compras (proveedor, costo, remarcado, unidades por bulto).
📊 Control (stock, ABC, auditoría, vencimiento).
📣 Marketing (campaña, prioridad, última publicación).

8. El orden del catálogo nunca será automático. Siempre responderá a una estrategia comercial definida por el distribuidor para aumentar las ventas.