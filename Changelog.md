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
- Listado de novedades
- Agregar cupon de descuento en carrito
- Agregar sistema de puntos.
- Utilizar favoritos para sistema de puntos.
- Agregar precio con descuento.
- Agregar carrousel
- Busqueda por codigo de barra.
- Busqueda por foto del producto.
- Cuando un producto esta sin stock se pone una campana de aviso: Útil si se acompaña de un llamado a la acción para avisar cuando vuelva a estar disponible. Proximamente disponible. Avisame cuando este disponible. Estos dos ultimos acompañados de la campanita.
- Iconos en la card del producto: "i" (circulo de informacion adicional del producto).
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


[5.8] 19-10-2026

- Chips (filtros rápidos) debajo del buscador, en una fila con scroll horizontal: Ofertas, Nuevos, Liquidación, Más vendidos, Solo x hoy, Sin TACC y Niños (íconos provisorios con emoji).
- Se configuran en cliente/config.js (sección chips): orden, texto, ícono y, opcional, las cintas que entran solas (Ofertas = Preciazo!, Al costo!, 2x1; Nuevos = Nuevo sabor!; Liquidación = Liquidación!).
- Etiquetas en keywords con #: "Marolio fideos #sintacc #ninos". No cuentan para el buscador ni para los posters. "#hoy:2026-10-20" vale solo ese día.
- Un chip a la vez; tocarlo de nuevo lo desmarca. Se combina con el buscador. Un chip sin productos no aparece.
- Tarjetas: íconos de sus chips (por etiqueta) arriba a la derecha, hasta 2; si hay más, el segundo lugar muestra "+N".
- Service worker v6 (archivos nuevos js/chips.js y css/chips.css).


[5.9] 19-10-2026

- Chip marcado dentro del buscador (a la derecha, antes de la X de borrar texto), con una X en la esquina: tocándolo se quita el filtro. Se puede seguir escribiendo con el chip activo.
- Íconos de los chips en 3D con sombra (provisorios, SVG en imagenes/chips/). En el config, "icono" acepta una imagen o un emoji; en la tarjeta los íconos 3D van sin círculo blanco y con su propia sombra.


[6.0] 19-10-2026

- Los chips se combinan: con varios marcados se ven los productos que están en todos (ej. Niños + Sin TACC, Ofertas + Limpieza). También se combinan con el buscador.
- Dentro del buscador: con un chip se ve ícono + nombre; con varios, solo los íconos. Cada uno tiene su X para quitarlo.
- Chips nuevos: Comestibles y Limpieza, con íconos 3D. Entran solos por categoría (opción "categorias" del chip en el config).
- Los íconos 3D dibujados quedan como definitivos.
- Config: sección comprasPorGrupo preparada (supplier, nombre, montoMinimo, orden, icono, condiciones). Todavía no está activa.
- Posters: precio al doble de tamaño, proporcional al ancho del poster (destacado o de ancho normal), con borde blanco y sombra fuerte para que se despegue de la imagen.


[6.1] 19-10-2026

- Fila de chips: en la computadora también se desliza arrastrando con el mouse o con la rueda (en el celular, con el dedo). Arrastrar no marca el chip. Desvanecidos a la izquierda y a la derecha según haya más chips para ese lado.
- Íconos 3D (misma línea que los chips) en la bienvenida (precios finales, entrega, pago, compra mínima), en los mensajes institucionales (entrega, envío gratis, pago, cantidad) y en la manito que señala al destacado. Están en imagenes/iconos/.


[6.2] 19-10-2026

- Manos 3D nuevas: la que señala al destacado (puño con el índice hacia abajo y puño azul) y la que saluda en la bienvenida, al lado de "¡Hola!", con movimiento de saludo. Nuevo campo bienvenida.saludoIcono en el config.
- Bienvenida: el texto de cierre ya no va todo en negrita; solo "comodidad", "fácil", "rápido" y "mejor precio" (se marcan con ** ** en el config).
- Precio de los posters de ancho normal: grande también en computadora (antes solo se agrandaba en el celular).


[6.3] 19-10-2026

- Chips nuevos Bebidas (BEBIDAS SIN ALCOHOL, BEBIDAS CON ALCOHOL y JUGOS) e Higiene (HIGIENE PERSONAL y PAPELES). JUGOS sale de Comestibles.
- Comestibles (206) + Bebidas (51) + Limpieza (65) + Higiene (77) = los 399 productos, sin repetidos.
- Íconos 3D: Liquidación pasa a ser el fueguito; nuevos de Bebidas e Higiene; Efectivo o transferencia ahora con billetes y celular con transferencia.


[6.4] 19-10-2026

- Se sacan los chips Comestibles, Bebidas, Limpieza e Higiene (se encuentran fácil scrolleando o buscando). La opción "categorias" de los chips queda disponible en el config.
- Favoritos (sin servidor, se guarda en el celular del cliente):
  - Corazón en cada tarjeta, en el borde entre la foto y los datos, a la derecha. Tocarlo lo guarda o lo quita, con un pequeño latido.
  - Lo que se compra (pedido enviado por WhatsApp) queda como favorito automáticamente.
  - Chip "Favoritos" (primero de la fila); aparece cuando hay al menos un favorito.
  - Al volver a entrar, aviso "Tenés N favoritos para agregar" con botón Ver (una vez por día, solo si hay favoritos con stock que no están en el pedido).
- Íconos 3D: Más vendidos (medalla con cintas y "MÁS VENDIDOS"), Solo x hoy (calendario "HOY" con rayo), corazón de Favoritos, y el de pago con billetes y celular con el logo de Mercado Pago en la pantalla.
- Fila de chips estilo YouTube: desvanecido más ancho a los costados y, con mouse, flechas redondas para pasar los chips.
- Service worker v7 (archivo nuevo js/favoritos.js).


[6.5] 19-10-2026

- Desvanecido de la fila de chips como en el video de referencia (estilo YouTube): los chips se vuelven transparentes hacia el borde con una máscara (antes se tapaban con color). Cada lado se desvanece solo si hay chips escondidos de ese lado: al principio solo la derecha, en el medio los dos, al final solo la izquierda, en proporción a lo que queda por ver.


[6.6] 19-10-2026

- Botones con volumen (como el video de referencia): degradé suave y 4 sombras (luz arriba, sombra abajo, contacto y brillo de su propio color). Al apretarlos se hunden 1 px con sombra interna.
- Se aplica a: Agregar, Ver pedido, Enviar pedido por WhatsApp, ¡Vamos! de la bienvenida, Ver del aviso de favoritos, chip marcado (en la fila y en el buscador) y la pastilla Unidad/Bulto. Archivo nuevo css/botones.css (cada botón define su color con --tono).
- Service worker v8.


[6.7] 19-10-2026

- Botones con volumen en versión clara: contador − / +, flechas de los chips y "Ver variedades" de los posters.
- Pantalla de carga: fondo del color del logo (#F75101, el naranja del ícono), logo flotando, ruedita girando y "Cargando…". Se va con un fundido cuando el catálogo está listo (mínimo medio segundo, máximo 8). Se configura en cliente/config.js → carga.
- Manifest: background_color #F75101, así la pantalla que muestra el celular al abrir la app instalada tiene el mismo color que la pantalla de carga (antes era casi blanca).


[6.8] 19-10-2026

- Créditos: "Diseñado y desarrollado por Ces.Art" al final del catálogo y al pie del cartel de Info. Ces.Art va subrayado en violeta con una flechita, para que se note que es un link, y abre el WhatsApp de Ces.Art (+54 9 11 5802-1519) con un mensaje armado. Está en js/creditos.js (parte del programa, no del config del cliente).
- Pantalla de carga premium: degradé radial (centro más claro y cálido, bordes más profundos), halo de luz detrás del logo que late suave y un brillo que cruza la pantalla en diagonal cada tanto.
- Service worker v9 (archivo nuevo js/creditos.js).


[6.9] 19-10-2026

- Cartel de Info: los créditos de Ces.Art pasan a una franja de pie propia (línea arriba y fondo gris clarito de borde a borde), separada de "Lo volvés a ver cuando quieras tocando Info", para que no se mezclen con la información de la distribuidora.



[7.0] 21-10-2026

- Bienvenida: se saca el alias de "¿Cómo pago?" (se lo pasás al cliente al confirmarle el pedido). La opción alias: true sigue disponible en el config para otras distribuidoras.
- Portada de carga: se va recién cuando la app está lista del todo (catálogo armado, buscador funcionando, letras descargadas y fotos de la primera pantalla cargadas). Máximo 12 segundos por si la conexión es muy lenta. La bienvenida se arma mientras tanto y se abre cuando se va la portada, ya con sus imágenes cargadas.
- Carga diferida de fotos: cada foto se descarga recién cuando la tarjeta se acerca a la pantalla al deslizar. Al abrir se piden unas 12 fotos en vez de las 400.
- Buscador: las tarjetas de abajo muestran exactamente los mismos productos que la lista de candidatos y en el mismo orden (grupo por grupo y, dentro de cada uno, el orden del catálogo). Si la lista no encuentra nada (palabra mal escrita), queda la búsqueda aproximada de antes.
- Excel: la columna inStock pasa a la G (al lado de keywords). Nueva fórmula en "Formula Excel products-data.txt".
- Service worker v10.


[7.1] 21-10-2026

- Buscador: los productos sin stock van al final de su categoría, tanto en la lista de candidatos como en las tarjetas de abajo (siguen coincidiendo en el mismo orden). Lo mismo al filtrar con chips. Así el cliente ve primero lo que puede comprar.
- Palabras reservadas en el config (cliente/config.js → palabrasReservadas). Valen hasta cerrar la app; vacío = desactivada:
  - quiebre: muestra solo los productos sin stock (antes estaba fija en el código).
  - send: habilita el pedido sin compra mínima. Ahora el botón dice "Copiar pedido y elegir contacto": copia el ticket armado y abre el menú de compartir del celular para elegir a quién mandarlo (ya no se manda solo al WhatsApp de la distribuidora). Si cerrás el menú sin elegir, el pedido queda armado y copiado. Vale para un pedido.
  - unlock (nueva): pone todos los productos sin stock como disponibles.
- Service worker v11.


[7.2] 21-10-2026

- Corregido: al apretar el botón Agregar, el botón saltaba media tarjeta a la derecha mientras se mantenía apretado (se notaba más en el celular y con los productos desbloqueados con "unlock"). Era el efecto de "hundirse" de los botones con volumen, que le borraba el centrado. Lo mismo pasaba al pasar el mouse sobre un "Próximamente".
- Service worker v12.


[7.3] 23-10-2026

- Vista previa al compartir el link (Open Graph): imagen nueva cliente/og-imagen.jpg de 1200 × 630 (formato grande de WhatsApp y Facebook) con la mascota, "La Moneda Mayorista", "Líderes en precios bajos" y tres ventajas con íconos 3D: Más cantidad, mejor precio · Entrega en el día · Envío sin cargo. Antes se usaba el ícono de la app (512 × 512, se veía chiquito).
- index.html: medidas, tipo, texto alternativo y tarjeta grande para X/Twitter. La dirección lleva ?v=1: si se cambia la imagen, subir el número para que WhatsApp la vuelva a buscar.


[7.4] 23-10-2026

- Chip Nuevos: ahora también toma las cintas "Nuevo!" y "Nueva!" (antes solo "Nuevo sabor!"; por eso no aparecían las Sarava palmeritas).


[7.5] 24-10-2026

- Vista previa al compartir: las direcciones de la imagen y del link pasan a https://lamoneda.com.ar/ (el sitio publicado está en Netlify con dominio propio; la dirección vieja de GitHub Pages da "Site not found", así que WhatsApp no encontraba la imagen).


[7.6] 24-10-2026

- Posters con precio mayorista: si todas las variedades tienen el mismo precio por unidad y el mismo precio mayorista (PrecioPorVolumen), la etiqueta muestra el mayorista con su condición al lado ("$ 799 c/u desde 2u", o "por caja 12u", según UnidadesPorVolumen y PresentacionPorVolumen), en la misma posición de siempre. El precio por unidad no se muestra en el poster (se probó en un segundo renglón y confundía); se ve al abrir las variedades. Si las variedades no coinciden en precios, queda como antes.
- Service worker v13.


[7.7] 27-10-2026

- Chips con estilo de "accesos" (como Mercado Libre): ícono 3D grande (56 px) arriba y el nombre chiquito abajo, sin pastilla. El chip marcado lleva un círculo de color detrás del ícono, el nombre en negrita y una rayita naranja debajo. Se sacó el chip marcado de los botones con volumen (css/botones.css).
- Service worker v14.

[7.8] 27-10-2026

- Corregido: el chip Favoritos aparecía aunque no hubiera ningún favorito guardado (el estilo nuevo de la 7.7 le ganaba al "oculto"). Ahora solo aparece con al menos un favorito, como antes.


[7.9] 27-10-2026

- Ofertas "Solo x hoy" y rebajas (archivo nuevo js/ofertas.js). Salen de dos columnas del Excel: web (FechaOferta) y PrecioOferta.
  - Con PrecioOferta y la fecha de hoy: "Solo x hoy". Con otra fecha se ignora (se puede cargar la semana por adelantado). Sin fecha: rebaja permanente.
  - La oferta tiene que ser menor que price e igual o menor que PrecioPorVolumen. Si no, no se aplica y se avisa en la consola del navegador.
  - Se vende con el step de price y sin el interruptor Unidad/Bulto.
- Tarjeta "Solo x hoy": destacada a 2 columnas solo ese día, cinta "Solo x hoy" amarilla (reemplaza la cinta que tenga), precio de oferta grande en rojo, al lado el precio normal tachado y el globito con el % de ahorro, y borde luminoso giratorio con resplandor (css/ofertas.css). Se queda en su lugar, dentro de su categoría.
- Agotado en medio del día: la tarjeta sigue apareciendo, en gris, con la franja roja "AGOTADO!" y el botón "Agotado" desactivado.
- Grupos (posters): si todas las variedades tienen la misma oferta, el poster la toma: destacado, con la cinta, el borde y la etiqueta con el precio de oferta, el tachado y el %. Las variedades van de ancho normal.
- Rebaja permanente: precio tachado y rebajado, entra en el chip Ofertas, no se destaca y, si no tiene cinta, lleva "Rebaja!".
- Carrusel 3D "Ofertas de hoy" (archivo nuevo js/carrusel-ofertas.js): debajo del encabezado y antes del buscador, con cuenta regresiva hasta la medianoche. Gira solo; arrastrando se gira; tocando mientras gira se frena y trae al frente la tarjeta tocada; con el anillo quieto, la de adelante muestra "Ver oferta" (lleva al producto o abre las variedades del poster). A los 4 segundos sin tocar vuelve a girar. Las agotadas van al final, en gris. Deja de girar cuando no se ve. No es sticky y se oculta al buscar o filtrar. Con "reducir movimiento" (o con menos de 3 ofertas) se ve como una fila plana que se desliza.
- Chips: "Solo x hoy" muestra los productos con oferta vigente (opción oferta: "hoy" en el config; la etiqueta #hoy:fecha se sigue aceptando). "Ofertas" suma las rebajas permanentes (oferta: "rebaja"). Los dos aparecen y desaparecen solos.
- Medianoche: la oferta se apaga sola aunque la app esté abierta. Lo que está en el carrito pasa al precio normal con el aviso "Actualizamos tu pedido".
- Pedido: el ticket de WhatsApp dice "🔥 Oferta 27/10 · $699 (antes $899)" (o "🏷️ Rebaja · …"), y la hoja "Tu pedido" muestra el precio normal tachado. El buscador muestra el precio de oferta.
- Tarjeta "Solo x hoy" (ajuste): abajo de la foto, dos columnas. A la izquierda el nombre, el precio de oferta c/u y el precio normal c/u tachado; a la derecha el botón sello de lacre dorado ("¡APROVECHALO!", carrito, "x2" con el step y "AGREGAR"). Cada toque suma un step; con el producto en el pedido muestra la cantidad en el medio y los botones − y + dorados abajo a los costados. El % va en un globito arriba a la derecha de la foto y la cinta "Solo x hoy" es roja. En tarjetas angostas (variedades de un poster, búsqueda) el sello va debajo.
- Carrusel (ajuste): el botón sale afuera de la tarjeta (debajo, montado sobre el borde) para que la tarjeta no quede larga, y dice "Agregar": carga la oferta al pedido sin salir del carrusel; después se convierte en − cantidad +. En los grupos dice "Elegir variedad" y abre la lista de variedades debajo del anillo, cada una con su Agregar (mientras está abierta no gira). Debajo: "Deslizá para girar · tocá una tarjeta para traerla al frente". De fondo, rayos de luz naranja muy tenues, con bordes difuminados, que giran muy despacio (una vuelta cada 4 minutos, para no competir con el giro del anillo), como en las promos de supermercado, sobre un velo cálido; con "reducir movimiento" quedan quietos.
- Excel: nueva fórmula en "Formula Excel products-data.txt" (columna A = web/FechaOferta, J = PrecioOferta, fórmula en la W).
- Service worker v15.


[8.0] 28-10-2026

- Carrusel: el precio normal tachado va siempre en un segundo renglón, abajo del precio de oferta, así todas las tarjetas tienen el mismo alto.
- Pantalla completa: la app instalada ocupa el 100% de la pantalla, sin la barra de estado ni la barra de navegación del celular (cliente/manifest.json → display: fullscreen; en el navegador sigue igual). Se deja el lugar de la cámara y de la rayita de gestos para que el buscador, el pie del pedido y el botón de WhatsApp no queden tapados. En iPhone la barra de estado no se puede ocultar: la app se dibuja por debajo de ella.
- Para que tome la pantalla completa hay que desinstalar la app del celular y volver a instalarla.
- Service worker v16.


[8.1] 29-10-2026

- Placas para redes (archivos nuevos js/redes.js y css/redes.css). Escribiendo "redes" en el buscador se arma una imagen cuadrada (1080 × 1080, 1:1) por cada oferta "Solo x hoy" del día y se abre la ventana "Placas para redes".
  - Cada placa: la foto con marco blanco, línea dorada y resplandor amarillo sobre el naranja de la empresa con rayos suaves; cinta roja "Solo x hoy! 29/10" en diagonal arriba a la izquierda (la fecha en amarillo); logo y "La Moneda mayorista" chiquito arriba a la derecha; abajo a la izquierda el cartel amarillo con el nombre, el precio de oferta grande en rojo, el precio normal tachado y la estrella con el %.
  - Van las mismas ofertas del carrusel: un grupo (poster) con todas sus variedades en la misma oferta es una sola placa. Las agotadas no van.
  - "Guardar las N": en Android se descargan y aparecen en la galería (álbum Descargas); el navegador puede preguntar una vez si permite varias descargas. En iPhone se abre el menú de compartir con "Guardar imágenes" (van a Fotos). "Compartir" (Android) las manda todas juntas a WhatsApp, Instagram, etc. Tocando una placa se guarda solo esa.
  - Archivos: oferta-2026-10-29-01-nombre-del-producto.jpg.
- cliente/config.js: palabra reservada nueva (palabrasReservadas.redes) y sección "redes" con el texto de la cinta, el texto junto al logo, el logo y el color de fondo.
- Service worker v17.

[8.2] 29-10-2026

- Redes: escribiendo "redes" ahora se arman portadas con todas las ofertas del día juntas:
  - 1 portada para historias (1080 × 1920): arriba el logo, "OFERTAS DEL DÍA" y la cinta "Solo x hoy! 29/10"; en el medio todas las fotos en grilla, cada una con su cartel de precio y el %; abajo "¡Pedí ya desde el catálogo!". Arriba y abajo queda libre lo que tapa Instagram.
  - 1 portada para el feed (1080 × 1080) por grupo, para que las fotos no queden chicas: "Almacén" y "Limpieza y perfumería" (en cliente/config.js → redes.feed, por categoría). Un grupo sin ofertas ese día no se arma.
  - La grilla se acomoda sola a la cantidad (con 4 por grupo, 2 × 2; la última fila incompleta va centrada).
  - "Guardar las 3" guarda la historia y las dos del feed. Las placas por producto siguen, plegadas en "Placas por producto".
- cliente/config.js → redes: tituloHistoria, pieHistoria y feed (grupos con su título y sus categorías).
- Service worker v18.

[8.3] 29-10-2026

- Redes: en las portadas cada foto queda cuadrada (1:1, como la original), sin franjas blancas a los costados. El cartel del precio va encima de la foto, abajo a la izquierda, sin salirse de ella, y arriba del precio lleva el nombre del producto en letra chica.
- Placa por producto: el cartel del precio ya no se sale de la foto.
- Historia: el nombre de cada producto va afuera de la foto, arriba de ella, en blanco, alineado a la izquierda y pegado a la foto (hasta 2 renglones). Más espacio entre fotos para que se vea qué nombre es de cada una. En el feed el nombre sigue chiquito dentro del cartel del precio.
- Service worker v19.

---

VERSIÓN DE PRODUCCIÓN: 6.9 (19-10-2026)
- Congelada para subir a GitHub. Lo que sigue (compra por grupo, etc.) va en versiones nuevas.
- Orden de los chips (de izquierda a derecha): Solo x hoy, Liquidación, Ofertas, Nuevos, Más vendidos, Niños, Sin TACC, Favoritos.
