# CHANGELOG

Todas las modificaciones importantes del proyecto se documentan en este archivo.

---

## [v1.1.0] - 2026-07-10 11:24PM

### Mejoras
- Cada producto se envía en una única línea con el formato:
  Cantidad × Producto (Precio Unitario).
- Se incorporó el "TOTAL ESTIMADO" al final del pedido.
- Se simplificó el encabezado del mensaje para una lectura más rápida.

### Correcciones
- Corregido el enlace de WhatsApp (`https://wa.me/${basePhone}`).

---

## [v1.0.0]

### Lanzamiento inicial
- Catálogo PWA.
- Búsqueda instantánea.
- Carrito de compras.
- Envío de pedidos por WhatsApp.
- Instalación como aplicación (PWA).
- Funcionamiento offline.

## [v1.6.0] 12-08-2026 01:07AM

### TERMINANDO EL HEADER PARA PRODUCCION
### Mejoras
- Se puso un auditor del uso del buscador por filtros avanzados.
- Se mejoro el reconocedor por voz.
- Se puso la "X" de borrado de texto con su sombreado gris.


## [v1.7.0] 12-08-2026 23:16
### TERMINANDO EL HEADER PARA PRODUCCION
### Mejoras
- Se saco el auditor del uso del buscador por filtros avanzados ya que corrompia el boton de enviar pedido.

## [v1.8.0] 13-08-2026 01:56
### TERMINANDO EL HEADER PARA PRODUCCION
### Mejoras
- Se implemento header de la empresa con datos inyectados
- Se implemento buscador sticky
- Se saco filtros avanzados.
- Se factorizo header.css
- se factorizo app.js
- Se creo theme.css
- Se creo config-data.js
- Se incorporan palabras que daban como resultado mal a la busquedas por voz.

### Implementar
- Cambiar url a la original LAMONEDA.COM.AR
- Grid 3 para productos sin stock y pasarlos a sin ribbon y sin destacado.
- Modal de inicio indicando: precios finales. envio gratis. medios de pago.
- Agregar afiche.
- Agregar separadores de secciones.
- Agregar carrito para editarlo.
- Agregar botones de categorias
- Listado de novedades
- Favoritos de productos.
- Utilizar favoritos para que el scrol sea mas corto.
- Agregar cupon de descuneto en carrito
- Agregar sistema de puntos.
- Utilizar favoritos para sistema de puntos.
- Agregar diferenciacion de precio x volumen.
- Agregar precio con descuento.
- Agregar carrousel
- Busqueda por codigo de barra.
- Busqueda por foto del producto.
- Agregar boton alias.
- Cuando un producto esta sin stock se pone una campana de aviso: Útil si se acompaña de un llamado a la acción para avisar cuando vuelva a estar       disponible. Proximamente disponible. Avisame cuando este disponible. Estos dos ultimos acompañados de la campanita.




[2.2]
- Se incorporo las reglas (search-input) en el input del buscador. Ahora aparece bien "lab" por "lav" de lavandina
- Se incorporo tambien "acamalada" por "acanalada".

[3.0]

Hasta esta version termine el input del buscador con respecto al listado de los candidatos. Solo resta depurar los console.log y comentarios de analisis

[3.1]

Se termine y dejo limpio el input del buscador con respecto al listado (le falta el css). Se elimino los console.log y los comentarios para analisis

[3.2]

En esta version se renderiza el listado de candidatos y se le dio estilo s a los grupos de candidatos

[3.3]

Aca vamos a darlo estilo al listado de candidatos en forma individual, o sea con imagen, nombre completo y precio.

[3.4]

Aca vamos a darle funcionalidad al listado desplegable de candidatos. Al selecionarlo el producto del dropdwon, me dirije al producto selecionado y se cierra el dropdown. Por ahora no se filtra el renderizado a ese unico producto ya que quiero elegir otro producto del grupo renderizado no necesito volver a escribir la busqueda. Doy funcionalidad tambien al grupo de candidatos.

[4.0]

- Que se refresque la PWA si es la primera vez en el dia que se ingresa. Se refresca por sroll o primer input, siempre y cuando la ultima actualizacion sea mas de 1 hora. Que se refresque el carrito de acuerdo a los datos actualizados y stock, pero que antes se refresque la PWA.
- BUG. vuelve a scroll 0 cuando agrego un item con el boton +.
- BUG. no me paarecen los candidatos cuando la palabra se busca por el medio.
- Cuando se empieza una nueva busqueda que los resultados aparezcan no scroleados de la ultima posicion que se dejo antes de empezar la busqueda.

[4.1]

- Se arreglo que en el listado de candiatos los productos sin stock ahora no se pueden seleccionar, no se agregan al carrito y se agrego la palabra proximanente debajo de la descripcion del producto, como asi tambien el formato de producto "disabled"