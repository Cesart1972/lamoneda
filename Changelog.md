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
- Grid 3 para productos sin stock y pasarlos a sin ribbon y sin destacado.
- Agregar botones de categorias
- Listado de novedades
- Favoritos de productos.
- Utilizar favoritos para que el scrol sea mas corto.
- Agregar cupon de descuneto en carrito
- Agregar sistema de puntos.
- Utilizar favoritos para sistema de puntos.
- Agregar precio con descuento.
- Agregar carrousel
- Busqueda por codigo de barra.
- Busqueda por foto del producto.
- Agregar boton alias.
- Cuando un producto esta sin stock se pone una campana de aviso: Útil si se acompaña de un llamado a la acción para avisar cuando vuelva a estar       disponible. Proximamente disponible. Avisame cuando este disponible. Estos dos ultimos acompañados de la campanita.
- Iconos en la card del producto: "i" (circulo de informacion adicional del producto) y "Sin TACC".
- Al primer ingreso preguntar "¿Para quién comprás?": "Para mi negocio o empresa" (compras frecuentes por volumen) o "Para consumo personal" (compras para tu hogar). Guardarlo en localStorage para saber que mostrarle y que novedades le interesan.




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

[4.2] 14-10-2026

- La PWA ahora se puede instalar: se agrego manifest.json e iconos (carpeta icons/).
- Se agrego el service worker (sw.js): funciona sin conexion. Codigo y datos se buscan siempre primero en internet (precios al dia) y si no hay conexion se usa la ultima copia guardada. Las imagenes se guardan en el celular y se actualizan en segundo plano.
- Se sacaron las recargas forzadas (primer ingreso del dia, primer scroll y primera busqueda).
- Nuevo js/pwa.js: registra el service worker y recarga el catalogo solo si el cliente vuelve a la app despues de 1 hora en segundo plano. El carrito se conserva.
- products-data.js se carga con un <script> normal (se saco el document.write con Date.now()).


[4.3] 14-10-2026

- Nueva carpeta cliente/ con todo lo propio de cada distribuidora:
  - cliente/config.js: empresa, numero de WhatsApp, nombre del vendedor (saludo del pedido), textos de los mensajes, colores, filtros, imagen de respaldo por categoria y reglas de busqueda.
  - cliente/manifest.json y cliente/icons/: nombre e iconos de la app instalada.
- Nuevo js/cliente.js: aplica la configuracion (colores sin parpadeo, logo, titulos, boton de WhatsApp, filtros).
- app.js, voiceSearch.js, share.js e index.html ya no tienen datos de La Moneda.
- El boton flotante de WhatsApp ahora usa wa.me con el mensaje de consulta (antes whatsapp://, que no anda en PC).
- Se quitaron los filtros "comestibles" y "limpieza" (ningun producto tenia esos datos).
- Ya no se usan: config-data.js, js/search-rules.js, manifest.json e icons/ de la raiz (se pueden borrar).


[4.4] 14-10-2026

- BUG. El carrito se guardaba con la posicion del producto en products-data.js: al agregar o quitar productos, el carrito guardado cargaba otro producto. Ahora se guarda con el Id del producto.
- BUG. La lista desplegable de productos del buscador mezclaba posicion e Id (una de las dos funciones del boton buscaba otro producto). Ahora todo usa el Id.
- El carrito se guarda con otro nombre ("carrito") e incluye precio y nombre de cada producto. Los carritos viejos se convierten solos una unica vez.
- Al abrir o actualizar la PWA, el carrito se sincroniza con products-data.js: se quitan productos sin stock o que ya no estan, se ajusta la cantidad si cambio la compra minima (step) y el total usa siempre el precio actual.
- Nuevo aviso "Actualizamos tu pedido" que le explica al cliente que cambio en su carrito.
- El pedido de WhatsApp lista los productos en el orden del catalogo (igual que antes).


[4.5] 15-10-2026

- Precios por cantidad: cada producto puede tener una segunda forma de compra (caja, bulto, pack, pallet...). Columnas nuevas en products-data.js:
  - medida1: nombre de la forma 1 ("unidad" si esta vacio, "bulto", "caja"...).
  - precio2: precio POR UNIDAD comprando de la forma 2 (vacio = un solo precio).
  - medida2: nombre de la forma 2.
  - unidades2: unidades que trae esa medida.
  - minimo2: cantidad minima de esa medida (vacio = 1).
- Diseño A: interruptor (Unidad | Caja) con animacion, precio por unidad grande, y abajo "Comprá por caja x12 y pagá $689 c/u" (precio resaltado). Al elegir la forma 2: "Estás ahorrando 10% frente a unidad". El % se calcula solo.
- El contador muestra "2 cajas" y debajo del precio "24 u. · $17.256". El monto es siempre unidades totales x precio por unidad.
- Si se cambia de forma con el producto en el carrito, se convierten las unidades.
- Precio escalonado (misma medida, ej. "5 bultos o más"): al llegar al minimo aplica solo el mejor precio y al bajar vuelve al precio normal.
- El mensaje de WhatsApp muestra "2 cajas (24 u.) × Producto ($719 c/u)". Los productos sin columnas nuevas salen igual que antes.
- La sincronizacion del carrito tiene en cuenta la forma elegida (si un producto pierde el segundo precio, vuelve al precio normal y se avisa).
- Nuevo js/formas-compra.js con las reglas. Textos y "mostrarPrecioPor" en cliente/config.js (seccion precios).


[4.6] 16-10-2026

- Unidades sueltas O cajas cerradas (nunca mezcladas en el mismo producto).
- Comprando por unidad, al llegar a la cantidad de una caja pasa solo a "Caja" y el contador queda en 1 caja.
- Si hay cajas en el carrito y se toca "Unidad", la tarjeta pregunta "¿Querés comprar menos de 1 caja?". Si = queda en 1 unidad. No = sigue en caja. (Nunca se cobran 11 unidades sueltas en lugar de 1 caja.)
- Nuevo diseño: dos columnas debajo del interruptor, cada una con su precio ("por unidad" / "por caja 12u"). El precio de la caja va en rojo. Tocar la columna tambien elige esa forma.
- "Estás ahorrando X% frente a unidad" solo aparece con la caja elegida.
- Mismo precio por unidad y por caja: dejar precio2 vacio y completar medida2 y unidades2. La caja queda como atajo ("Caja x12u", sin rojo ni ahorro).
- precio2 mayor que price se toma como error: se muestra un solo precio.
- medida2 "unidad" (ej. precio desde 24 unidades) se muestra como "x24" / "desde 24u".
- Al abrir la PWA, si un carrito guardado tiene por unidad la cantidad de una caja, pasa a caja y se avisa.
- config.js (precios): se saco textoInvitacion; nuevos textoPregunta, textoPreguntaSi y textoPreguntaNo.


[4.7] 16-10-2026

- El subtotal del carrito ("12 u." / "$26.388") ahora va dentro de la columna de la forma elegida (debajo de "por caja 12u").
- "Estás ahorrando X% frente a unidad" se ve desde el principio; solo se oculta si el producto ya esta en el carrito por unidad.
- Mismo precio por unidad y por caja: un solo precio centrado debajo del interruptor, sin "por unidad". El boton dice "Caja x12u". El subtotal va debajo del precio.


[4.8] 16-10-2026

- Badge rojo "8%" dentro del boton "Caja" del interruptor. Al elegir la caja el badge se va y aparece "Estás ahorrando 8% frente a unidad". Ya no se muestra ese texto desde el principio (menos carga en pantalla).
- En lugar del subtotal, debajo de "por caja 12u" se muestra cuanto vale una caja: "Caja $26.388" (en una linea; solo montos muy largos como un pallet pasan a una segunda linea).
- Mismo precio: con la caja elegida, debajo del precio dice "Caja $16.788".


[4.9] 16-10-2026

- Debajo de "por caja 12u" se ve desde el principio lo que vale una caja: "$26.388" (mismo formato que "por caja 12u", sin negrita). Igual para bulto y pallet.
- Mismo precio: "Caja $16.788" se ve desde el principio debajo del precio.
- Precio escalonado: el boton dice "+5 bultos" (antes "5+ bultos").


[5.0] 16-10-2026

- Vista previa al compartir el link por WhatsApp: titulo, descripcion e imagen escritos en index.html (WhatsApp no ejecuta JavaScript). Cambiar la URL cuando se pase al dominio propio.
- Productos sin foto o con foto inexistente: se muestra el dibujo de la categoria (antes imagen rota).
- Encabezado: icono clasico de Compartir (tres puntos) con la palabra "Compartir" y nuevo boton "Info".
- Modal de bienvenida una vez por dia, con el personaje de La Moneda: precios finales, cuando llega, como pago (alias con boton Copiar) y compra minima. Se vuelve a abrir con "Info". Textos en cliente/config.js (seccion bienvenida).
- Campos renombrados: PresentacionVenta, PrecioPorVolumen, PresentacionPorVolumen, UnidadesPorVolumen, MinimoPorVolumen (los nombres viejos siguen funcionando). Nuevo js/datos.js.
- Nuevo campo TipoMuestra: producto, poster o separador. Posters sin precio ni Agregar: al tocarlos busca su linea (keywords, despues name, despues brand). Separadores: titulo de seccion. Sin stock al final de cada seccion. Posters y separadores no aparecen en el buscador, la voz, los filtros ni el carrito.
- Nueva formula de Excel en "Formula Excel products-data.txt".
- "Ver pedido": hoja con el pedido para revisar (+, -, Quitar) antes de enviar por WhatsApp.
- Compra minima ($30.000, en cliente/config.js): renglon rojo debajo del boton del pie y del boton Enviar, que queda bloqueado. En la hoja dice cuanto falta.
- Palabra escondida "send" en el buscador: habilita enviar por debajo del minimo hasta cerrar la app.


[5.1] 16-10-2026

- Poster como desplegable: boton "Ver variedades (N)" encima del poster (abajo y centrado, pildora con flecha). Al tocarlo aparecen debajo, con animacion, los productos cuyos keywords contienen todas las palabras de los keywords del poster. No filtra ni toca el buscador. "Ocultar variedades" los cierra. Esas variedades no se repiten en la lista (scroll mas corto); el buscador las sigue encontrando.
- Hoja del pedido: el boton Enviar y el renglon rojo de compra minima forman un solo bloque (bordes redondeados arriba del boton y abajo del renglon).
- Hoja del pedido: al quitar un producto (boton Quitar o contador en cero) la fila desaparece con una transicion suave.
- Bienvenida: cierre "¡Eleginos y disfrutá de comprar fácil, rápido y al mejor precio! 🛍️" y boton "¡Vamos!".


[5.2] 16-10-2026

- "Ver pedido": la hoja sube suavemente desde el borde inferior y el fondo se oscurece de a poco; al cerrar baja de la misma forma.
- Posters: precio grande abajo a la izquierda (fondo rojo, letra amarilla) solo si todas sus variedades tienen el mismo precio. Si hay precios distintos no se muestra ninguno. El precio sale de products-data.js, asi el poster nunca queda desactualizado.


[5.3] 16-10-2026

- Lista completa (sin buscar ni filtrar): barra de color con el nombre de la categoria (en mayusculas) cada vez que cambia la categoria. Si justo antes hay un separador manual (TipoMuestra separador), manda el manual. Los separadores manuales ahora usan la misma barra.
- Huecos que dejaban las tarjetas destacadas (ancho doble) que no entraban en la fila:
  - si lo que sigue es una categoria nueva: "pestaña" del mismo color que llena el hueco ("Seguimos con LECHES · 2 productos ↓") pegada a la barra;
  - si lo que sigue es un poster destacado: el poster se muestra de ancho normal;
  - si lo que sigue es un producto destacado: tarjeta amarilla con la manito 👇 y el texto de la cinta del destacado (o "¡Mirá esta oferta!"). Al tocarla lleva al destacado, que brilla un momento.
  - Se recalcula al abrir/cerrar variedades de un poster y al cambiar el ancho de pantalla (celular 2 columnas, PC 4).
- Al buscar o filtrar no hay barras, pestañas ni manito.
- Sin stock al final de su categoria (antes iban al final de todo el catalogo y repetian categorias).
- Posters de ancho normal en el celular: boton mas compacto (sin flecha) y "Ocultar" en lugar de "Ocultar variedades" para que no se corte.


[5.4] 16-10-2026

- Al buscar o filtrar (texto, voz o grupo de sugerencias), los destacados se muestran de ancho normal: conservan el borde rojo y la cinta, pero ya no dejan huecos.


[5.5] 16-10-2026

- Los huecos antes de una categoria nueva ya no tienen la pestaña: se llenan con mensajes institucionales y todas las barras de categoria quedan iguales.
- Los mensajes se cargan en cliente/config.js (seccion institucional). Cada uno puede tener una imagen formato historia (1080x1920) en imagenes/institucional/ y/o un icono, titulo y texto. Con imagen se muestra la imagen; sin imagen (o si no se encuentra), una tarjeta naranja de texto. Lista vacia = logo de la empresa.
- Se van turnando en orden y entran desde la derecha la primera vez que aparecen al scrollear (no se repite la animacion al abrir posters).
- Mensajes de ejemplo provisorios (entrega en el dia, efectivo o transferencia, precio por cantidad, compra minima) hasta cargar los definitivos.


[5.6] 16-10-2026

- Mensajes institucionales: se agrega "Envío sin cargo"; se sacan el alias y la compra mínima (no van como propaganda).
- Hoja "Tu pedido": transición más lenta y sutil (sube en 0,75 s frenando de a poco, aparece con un fundido y el fondo se oscurece en 0,7 s). Al cerrar, igual.
- La pantalla vuelve arriba de todo cada vez que aparecen resultados nuevos: al elegir un grupo de las sugerencias, con la búsqueda por voz y al cambiar o quitar filtros (al escribir ya lo hacía). Al elegir un producto de las sugerencias sigue llevando a ese producto.


[5.7] 18-10-2026

- Bienvenida: nuevo mensaje "¡Desde la comodidad de tu casa o negocio comprá fácil, rápido y al mejor precio!".
- Compra mínima: "Te faltan $X" se calcula con el mismo total redondeado que se muestra (antes podía diferir en hasta $50).
