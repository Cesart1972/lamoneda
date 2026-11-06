-- =========================================================
-- 1. ESQUEMA: TABLAS
-- ---------------------------------------------------------
-- PWA distribuidores · Ces.Art · modelo v4 (05-11-2026)
-- Un solo proyecto de Supabase para todas las distribuidoras.
-- Toda tabla de una distribuidora lleva empresa_id.
-- Cantidades siempre en UNIDADES (enteros). Plata en numeric(12,2).
-- =========================================================

create extension if not exists pgcrypto with schema extensions;


-- =========================================================
-- 0. PLATAFORMA CES.ART
-- =========================================================

-- Usuarios de Ces.Art: dueño de la plataforma y cobradores
create table public.plataforma_miembros (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  nombre    text not null,
  telefono  text,
  rol       text not null check (rol in ('dueno_plataforma', 'cobrador')),
  activo    boolean not null default true,
  creado    timestamptz not null default now()
);

-- Una fila por distribuidora
create table public.empresas (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  dominio             text,
  plan                text not null default 'basico' check (plan in ('basico', 'pro')),
  abono_monto         numeric(12,2) not null default 0 check (abono_monto >= 0),
  -- Primer día del último mes cubierto (null = nunca pagó)
  abono_pagado_hasta  date check (abono_pagado_hasta is null or extract(day from abono_pagado_hasta) = 1),
  estado_manual       text not null default 'normal'
                      check (estado_manual in ('normal', 'suspendida', 'baja', 'cortesia')),
  cortesia_hasta      date,
  creado              timestamptz not null default now()
);

create table public.cobrador_empresas (
  cobrador_id  uuid not null references public.plataforma_miembros(user_id) on delete cascade,
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  primary key (cobrador_id, empresa_id)
);

-- Código que el dueño de la distribuidora escribe en el celular del cobrador al pagar.
-- Lo ve solo el dueño de esa distribuidora (seguridad en 4_seguridad).
create table public.codigos_pago_abono (
  id          bigint generated always as identity primary key,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  mes_desde   date not null,
  mes_hasta   date not null,
  monto       numeric(12,2) not null,
  codigo      text not null,
  generado    timestamptz not null default now(),
  usado_en    timestamptz,
  intentos    int not null default 0,
  check (mes_hasta >= mes_desde)
);
create unique index codigos_pago_abono_vigente on public.codigos_pago_abono (empresa_id) where usado_en is null;

create table public.rendiciones (
  id              bigint generated always as identity primary key,
  cobrador_id     uuid not null references public.plataforma_miembros(user_id),
  creado          timestamptz not null default now(),
  monto_total     numeric(12,2) not null default 0,
  cantidad_pagos  int not null default 0,
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'confirmada', 'con_diferencia')),
  confirmada_por  uuid references auth.users(id),
  confirmada_en   timestamptz,
  diferencia      numeric(12,2),
  nota            text
);

create table public.pagos_abono (
  id                        bigint generated always as identity primary key,
  numero_recibo             bigint generated always as identity (start with 1001) unique,
  empresa_id                uuid not null references public.empresas(id),
  mes_desde                 date not null,
  mes_hasta                 date not null,
  monto                     numeric(12,2) not null check (monto > 0),
  medio                     text not null
                            check (medio in ('efectivo', 'link_mp', 'debito_mp', 'rapipago', 'pagofacil', 'transferencia')),
  cobrador_id               uuid references public.plataforma_miembros(user_id),
  confirmado_por_cliente_en timestamptz,
  lat                       double precision,
  lng                       double precision,
  referencia_externa        text,
  rendicion_id              bigint references public.rendiciones(id),
  creado                    timestamptz not null default now(),
  check (mes_hasta >= mes_desde)
);


-- =========================================================
-- 1. DISTRIBUIDORA: CONFIGURACIÓN Y USUARIOS DEL PANEL
-- =========================================================

create table public.empresa_config (
  empresa_id              uuid primary key references public.empresas(id) on delete cascade,
  modo_catalogo           text not null default 'publico_con_precios'
                          check (modo_catalogo in ('publico_con_precios', 'solo_listado')),
  compra_minima           numeric(12,2) not null default 0 check (compra_minima >= 0),
  redondeo                numeric(12,2) not null default 100 check (redondeo >= 0),
  whatsapp_numero         text,
  alias_transferencia     text,
  cbu                     text,
  titular                 text,
  hace_envios             boolean not null default false,   -- solo plan PRO
  retiro_en_local         boolean not null default true,
  horario_atencion        text,
  zona_horaria            text not null default 'America/Argentina/Buenos_Aires',
  local_direccion         text,
  local_localidad         text,
  local_referencias       text,
  local_lat               double precision,
  local_lng               double precision,
  local_horario           text,
  local_foto              text,
  encargado_ve_costos     boolean not null default false,
  encargado_edita_config  boolean not null default false,
  markup_minimo           numeric(6,4) not null default 0.20 check (markup_minimo >= 0),
  limitar_al_stock        boolean not null default false,
  faltantes_guardar       boolean not null default true,
  faltantes_precio        text not null default 'original' check (faltantes_precio in ('original', 'del_dia')),
  faltantes_sin_minimo    boolean not null default true,
  -- Máximo 7 días (decisión de César 05-11-2026)
  faltantes_vencen_dias   int not null default 7 check (faltantes_vencen_dias between 1 and 7),
  novedades_dias          int not null default 7 check (novedades_dias between 1 and 30),
  -- Lo visual: misma estructura que cliente/config.js
  apariencia              jsonb not null default '{}'::jsonb,
  actualizado             timestamptz not null default now()
);

create table public.miembros (
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null,
  telefono    text,
  roles       text[] not null
              check (array_length(roles, 1) >= 1
                     and roles <@ array['dueno', 'encargado', 'catalogo', 'armado', 'repartidor']),
  activo      boolean not null default true,
  creado      timestamptz not null default now(),
  creado_por  uuid references auth.users(id),
  primary key (empresa_id, user_id)
);
create index miembros_user on public.miembros (user_id);


-- =========================================================
-- 2. CATÁLOGO
-- =========================================================

create table public.categorias (
  id                bigint generated always as identity primary key,
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  nombre            text not null,
  orden             int not null default 0,
  -- Separador manual: siempre al comienzo de la categoría (si no hay, barra automática)
  separador_imagen  text,
  separador_texto   text,
  unique (empresa_id, nombre)
);

create table public.proveedores (
  id               bigint generated always as identity primary key,
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  nombre           text not null,
  contacto         text,
  telefono         text,
  -- Compra x grupo
  cg_activa        boolean not null default false,
  cg_monto_minimo  numeric(12,2),
  cg_icono         text,
  cg_condiciones   text,
  cg_orden         int not null default 0,
  unique (empresa_id, nombre)
);

-- Grupos (posters que agrupan variedades)
create table public.lineas (
  id            bigint generated always as identity primary key,
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  codigo        text,                       -- Id del poster en el Excel
  nombre        text not null,
  imagen        text,
  destacado     boolean not null default false,
  orden         int not null default 0,
  categoria_id  bigint references public.categorias(id) on delete set null,
  unique (empresa_id, codigo)
);

create table public.productos (
  id              bigint generated always as identity primary key,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  codigo          text not null,            -- Id del Excel
  nombre          text not null,
  marca           text,
  categoria_id    bigint references public.categorias(id) on delete set null,
  proveedor_id    bigint references public.proveedores(id) on delete set null,
  linea_id        bigint references public.lineas(id) on delete set null,
  keywords        text not null default '',
  etiquetas       text[] not null default '{}',   -- #sintacc #ninos #masvendidos #hoy...
  cinta           text,
  destacado       boolean not null default false,
  orden           int not null default 0,
  imagen          text,
  imagen_version  int not null default 1,
  ubicacion       text,                     -- lugar en el depósito
  codigo_barras   text,
  visible         boolean not null default true,
  markup_minimo   numeric(6,4),             -- vacío = el de la empresa
  creado          timestamptz not null default now(),
  actualizado     timestamptz not null default now(),
  unique (empresa_id, codigo)
);
create index productos_empresa_orden on public.productos (empresa_id, orden);

-- Precios en tabla aparte: en modo "solo listado" no los ve cualquiera.
-- Forma 1 = unidad (o la presentación de venta), forma 2 = por volumen.
create table public.producto_precios (
  producto_id           bigint primary key references public.productos(id) on delete cascade,
  empresa_id            uuid not null references public.empresas(id) on delete cascade,
  precio                numeric(12,2) not null check (precio >= 0),          -- price (por unidad)
  step                  int not null default 1 check (step >= 1),
  presentacion_venta    text not null default 'unidad',                      -- PresentacionVenta
  precio_volumen        numeric(12,2) check (precio_volumen is null or precio_volumen >= 0),  -- PrecioPorVolumen (por unidad)
  presentacion_volumen  text,                                                -- PresentacionPorVolumen
  unidades_volumen      int check (unidades_volumen is null or unidades_volumen >= 1),       -- UnidadesPorVolumen
  minimo_volumen        int check (minimo_volumen is null or minimo_volumen >= 1),           -- MinimoPorVolumen
  actualizado           timestamptz not null default now()
);

-- Ofertas: fecha = "Solo x hoy" ese día · fecha vacía = rebaja permanente.
-- Las de días pasados se guardan (sirven para respetar la oferta de un ticket viejo).
create table public.ofertas (
  id             bigint generated always as identity primary key,
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  producto_id    bigint not null references public.productos(id) on delete cascade,
  precio_oferta  numeric(12,2) not null check (precio_oferta > 0),
  fecha          date,
  activa         boolean not null default true,
  creado         timestamptz not null default now()
);
create index ofertas_producto on public.ofertas (producto_id, fecha);
create unique index ofertas_una_permanente on public.ofertas (producto_id) where fecha is null and activa;
create unique index ofertas_una_por_dia on public.ofertas (producto_id, fecha) where fecha is not null and activa;

-- Costo actual: tabla aparte, la ven solo dueño (y encargado si el dueño lo permite)
create table public.producto_costos (
  producto_id  bigint primary key references public.productos(id) on delete cascade,
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  costo        numeric(12,2) not null check (costo >= 0),
  actualizado  timestamptz not null default now()
);


-- =========================================================
-- 3. STOCK Y LISTA DE COMPRAS
-- =========================================================

create table public.stock (
  producto_id     bigint primary key references public.productos(id) on delete cascade,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  cantidad        int,                      -- null = stock no cargado
  -- Marca que queda entre pedidos; solo una compra la vuelve a 'disponible'
  marca           text not null default 'disponible' check (marca in ('disponible', 'critico', 'sin_stock')),
  actualizado_por uuid references auth.users(id),
  actualizado     timestamptz not null default now()
);

create table public.compras (
  id                 bigint generated always as identity primary key,
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  numero             int not null,
  fecha              date not null default current_date,
  cargada_por        uuid references auth.users(id),
  total              numeric(12,2) not null default 0,
  utilidad_esperada  numeric(12,2) not null default 0,
  markup             numeric(8,4),
  estado             text not null default 'borrador' check (estado in ('borrador', 'registrada')),
  creado             timestamptz not null default now(),
  registrada_en      timestamptz,
  unique (empresa_id, numero)
);

create table public.compra_items (
  id                 bigint generated always as identity primary key,
  compra_id          bigint not null references public.compras(id) on delete cascade,
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  producto_id        bigint not null references public.productos(id),
  cantidad           int not null default 0 check (cantidad >= 0),
  costo_unitario     numeric(12,2) not null default 0 check (costo_unitario >= 0),
  precio_referencia  numeric(12,2),         -- se congela al registrar
  unique (compra_id, producto_id)
);

create table public.stock_movimientos (
  id           bigint generated always as identity primary key,
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  producto_id  bigint not null references public.productos(id) on delete cascade,
  cantidad     int not null,                -- + entra, − sale
  motivo       text not null check (motivo in ('pedido', 'compra', 'ajuste', 'conteo', 'rotura', 'carga_inicial')),
  pedido_id    bigint,
  compra_id    bigint references public.compras(id),
  usuario      uuid references auth.users(id),
  creado       timestamptz not null default now(),
  uuid_origen  uuid unique                  -- evita duplicados al reenviar sin señal
);
create index stock_movimientos_producto on public.stock_movimientos (producto_id, creado);

create table public.lista_compras (
  id           bigint generated always as identity primary key,
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  producto_id  bigint not null references public.productos(id) on delete cascade,
  motivo       text not null check (motivo in ('critico', 'sin_stock', 'manual')),
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'en_compra', 'resuelto')),
  compra_id    bigint references public.compras(id) on delete set null,
  creado       timestamptz not null default now(),
  resuelto_en  timestamptz
);
create unique index lista_compras_un_pendiente on public.lista_compras (producto_id) where estado <> 'resuelto';


-- =========================================================
-- 4. CLIENTES
-- =========================================================

create table public.clientes (
  id                    bigint generated always as identity primary key,
  empresa_id            uuid not null references public.empresas(id) on delete cascade,
  user_id               uuid unique references auth.users(id) on delete set null,  -- vacío = ficha sin cuenta
  nombre                text not null,
  telefono              text not null,      -- formato internacional, ej. +5492346123456
  perfil                text not null default 'hogar' check (perfil in ('hogar', 'negocio')),
  nombre_negocio        text,
  entrega_preferida     text check (entrega_preferida in ('envio', 'retiro')),   -- solo PRO
  email                 text,
  estado                text not null default 'aprobado'
                        check (estado in ('sin_cuenta', 'pendiente', 'aprobado', 'suspendido', 'rechazado')),
  telefono_verificado   boolean not null default false,
  notas                 text,
  acepto_privacidad_en  timestamptz,
  creado                timestamptz not null default now(),
  unique (empresa_id, telefono)
);

-- Solo plan PRO
create table public.direcciones (
  id              bigint generated always as identity primary key,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  cliente_id      bigint not null references public.clientes(id) on delete cascade,
  etiqueta        text not null default 'casa',
  direccion       text not null,
  localidad       text not null,
  entre_calles    text,
  referencias     text,
  lat             double precision not null,
  lng             double precision not null,
  foto_frente     text not null,            -- ruta en Storage privado (nunca GitHub)
  predeterminada  boolean not null default false,
  creado          timestamptz not null default now()
);

create table public.favoritos (
  cliente_id   bigint not null references public.clientes(id) on delete cascade,
  producto_id  bigint not null references public.productos(id) on delete cascade,
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  creado       timestamptz not null default now(),
  primary key (cliente_id, producto_id)
);

create table public.codigos_reset (
  id           bigint generated always as identity primary key,
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  cliente_id   bigint not null references public.clientes(id) on delete cascade,
  codigo_hash  text not null,
  vence        timestamptz not null,
  intentos     int not null default 0,
  usado_en     timestamptz,
  creado_por   uuid references auth.users(id),
  creado       timestamptz not null default now()
);

create table public.push_suscripciones (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  dispositivo text,
  creado      timestamptz not null default now(),
  ultimo_uso  timestamptz
);


-- =========================================================
-- 5. PEDIDOS
-- =========================================================

create table public.pedidos (
  id                  bigint generated always as identity primary key,
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  numero              int not null,
  cliente_id          bigint not null references public.clientes(id),
  cliente_nombre      text not null,
  cliente_telefono    text not null,
  origen              text not null check (origen in ('app', 'whatsapp', 'local')),
  tipo_entrega        text check (tipo_entrega in ('envio', 'retiro')),        -- solo PRO
  direccion_id        bigint references public.direcciones(id) on delete set null,
  direccion_texto     text,
  estado              text not null default 'nuevo'
                      check (estado in ('nuevo', 'armando', 'listo', 'entregado', 'retirado', 'cancelado')),
  estado_pago         text not null default 'pendiente'
                      check (estado_pago in ('pendiente', 'aviso_transferencia', 'pagado')),
  medio_pago          text check (medio_pago in ('efectivo', 'transferencia')),
  incluye_faltantes   boolean not null default false,
  total_cliente       numeric(12,2),
  total_calculado     numeric(12,2) not null default 0,   -- con los precios del servidor
  total_final         numeric(12,2),                      -- lo entregado, redondeado
  armado_por          uuid references auth.users(id),
  armado_inicio       timestamptz,
  armado_fin          timestamptz,
  mensaje_enviado_en  timestamptz,
  horario_entrega     text,
  notas_cliente       text,
  notas_internas      text,
  uuid_origen         uuid unique,
  creado              timestamptz not null default now(),
  unique (empresa_id, numero)
);
create index pedidos_empresa_estado on public.pedidos (empresa_id, estado, creado);
create index pedidos_cliente on public.pedidos (cliente_id, creado);

create table public.avisarme (
  id               bigint generated always as identity primary key,
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  cliente_id       bigint not null references public.clientes(id) on delete cascade,
  producto_id      bigint not null references public.productos(id) on delete cascade,
  cantidad         int,                     -- unidades que faltaron (vacío si tocó 🔔 a mano)
  pedido_id        bigint references public.pedidos(id) on delete set null,
  precio_unitario  numeric(12,2),           -- precio al que lo pidió
  estado           text not null default 'esperando'
                   check (estado in ('esperando', 'avisado', 'agregado', 'descartado', 'vencido')),
  creado           timestamptz not null default now(),
  avisado_en       timestamptz,
  vence            timestamptz              -- se calcula al avisar (faltantes_vencen_dias)
);
create index avisarme_producto on public.avisarme (producto_id, estado);
create unique index avisarme_un_aviso_manual on public.avisarme (cliente_id, producto_id)
  where pedido_id is null and estado in ('esperando', 'avisado');

create table public.pedido_items (
  id                    bigint generated always as identity primary key,
  pedido_id             bigint not null references public.pedidos(id) on delete cascade,
  empresa_id            uuid not null references public.empresas(id) on delete cascade,
  producto_id           bigint not null references public.productos(id),
  orden                 int not null default 0,
  nombre                text not null,      -- copia del momento
  forma                 smallint not null default 1 check (forma in (1, 2)),   -- 1 unidad · 2 volumen
  medida                text,
  unidades_por_paso     int not null default 1,
  pedidas               int check (pedidas is null or pedidas >= 0),           -- vacío = lo agregó el admin
  entregadas            int not null default 0 check (entregadas >= 0),
  precio_unitario       numeric(12,2) not null,
  precio_visto_cliente  numeric(12,2),
  origen_precio         text not null default 'lista'
                        check (origen_precio in ('lista', 'volumen', 'oferta', 'grupo', 'faltante')),
  oferta_fecha          date,
  bonificacion          int not null default 0 check (bonificacion >= 0),
  avisarme_id           bigint references public.avisarme(id) on delete set null,
  agregado              boolean not null default false,
  hecho                 boolean not null default false,
  marca_stock           text check (marca_stock in ('critico', 'sin_stock')),
  marca_auto            boolean not null default false,
  marca_previa          text,               -- marca del producto antes de tocarla en este pedido
  conteo_real           int,
  unique (pedido_id, producto_id)
);

-- Costo congelado al enviar el pedido: tabla aparte (quien arma no ve costos)
create table public.pedido_items_costos (
  item_id         bigint primary key references public.pedido_items(id) on delete cascade,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  costo_unitario  numeric(12,2) not null
);

create table public.pedido_eventos (
  id         bigint generated always as identity primary key,
  pedido_id  bigint not null references public.pedidos(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo       text not null,
  detalle    jsonb not null default '{}'::jsonb,
  usuario    uuid references auth.users(id),
  creado     timestamptz not null default now()
);
create index pedido_eventos_pedido on public.pedido_eventos (pedido_id, creado);

alter table public.stock_movimientos
  add constraint stock_movimientos_pedido_fk foreign key (pedido_id) references public.pedidos(id) on delete set null;


-- =========================================================
-- 6. NOVEDADES
-- =========================================================

create table public.producto_eventos (
  id              bigint generated always as identity primary key,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  producto_id     bigint not null references public.productos(id) on delete cascade,
  tipo            text not null check (tipo in ('nuevo', 'precio_sube', 'precio_baja', 'sin_stock', 'reingreso')),
  valor_anterior  numeric(12,2),
  valor_nuevo     numeric(12,2),
  usuario         uuid references auth.users(id),
  creado          timestamptz not null default now()
);
create index producto_eventos_empresa on public.producto_eventos (empresa_id, creado desc);

create table public.novedades_reglas (
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  tipo        text not null check (tipo in ('nuevo', 'precio_sube', 'precio_baja', 'sin_stock', 'reingreso')),
  ve_hogar    boolean not null,
  ve_negocio  boolean not null,
  primary key (empresa_id, tipo)
);

create table public.novedades_vistas (
  cliente_id      bigint primary key references public.clientes(id) on delete cascade,
  borradas_hasta  timestamptz,
  ultima_vista    timestamptz
);


-- =========================================================
-- 7. NÚMEROS CORRELATIVOS POR DISTRIBUIDORA
-- =========================================================

create table public.contadores (
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,                -- 'pedido', 'compra'
  valor       int not null default 0,
  primary key (empresa_id, nombre)
);
