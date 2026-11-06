-- =========================================================
-- PRUEBAS (solo base local). Se corre con: tests/probar.sh
-- Cada bloque cambia de usuario y comprueba lo que puede y no puede hacer.
-- =========================================================
\set ON_ERROR_STOP 1
\set QUIET 1
\pset format unaligned
\pset tuples_only on

-- ---------- Ayudas de prueba ----------
create schema test;
grant usage on schema test to anon, authenticated, service_role;

create function test.ok(p boolean, p_msg text) returns text language plpgsql as $$
begin
  if p is not true then raise exception 'FALLÓ: %', p_msg; end if;
  return 'ok  ' || p_msg;
end $$;

-- Ejecuta y comprueba que falle con ese código de error
create function test.falla(p_sql text, p_codigo text, p_msg text) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_codigo or (p_codigo = '*' ) then return 'ok  ' || p_msg || ' (' || sqlerrm || ')'; end if;
    raise exception 'FALLÓ: % — esperaba "%", vino "%"', p_msg, p_codigo, sqlerrm;
  end;
  raise exception 'FALLÓ: % — esperaba error "%", no falló', p_msg, p_codigo;
end $$;
grant execute on all functions in schema test to anon, authenticated, service_role;

-- ---------- Usuarios ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'cesart@ces.art'),        -- dueño de la plataforma
  ('00000000-0000-0000-0000-00000000000c', 'cobrador@ces.art'),      -- cobrador (César)
  ('00000000-0000-0000-0000-000000000001', 'dueno@lamoneda'),
  ('00000000-0000-0000-0000-000000000002', 'armado@lamoneda'),
  ('00000000-0000-0000-0000-000000000003', 'catalogo@lamoneda'),
  ('00000000-0000-0000-0000-000000000011', '+5492346000011@la-moneda'),   -- cliente hogar
  ('00000000-0000-0000-0000-000000000012', '+5492346000012@la-moneda'),   -- cliente negocio
  ('00000000-0000-0000-0000-000000000013', '+5492346000013@la-moneda'),   -- se registra con un celular que ya pidió por WhatsApp
  ('00000000-0000-0000-0000-000000000099', 'dueno@otra');                 -- dueño de otra distribuidora

\set como_cesart   'reset role; set request.jwt.claim.sub = ''00000000-0000-0000-0000-00000000000a''; set role authenticated;'
\set como_cobrador 'reset role; set request.jwt.claim.sub = ''00000000-0000-0000-0000-00000000000c''; set role authenticated;'
\set como_dueno    'reset role; set request.jwt.claim.sub = ''00000000-0000-0000-0000-000000000001''; set role authenticated;'
\set como_armado   'reset role; set request.jwt.claim.sub = ''00000000-0000-0000-0000-000000000002''; set role authenticated;'
\set como_catalogo 'reset role; set request.jwt.claim.sub = ''00000000-0000-0000-0000-000000000003''; set role authenticated;'
\set como_hogar    'reset role; set request.jwt.claim.sub = ''00000000-0000-0000-0000-000000000011''; set role authenticated;'
\set como_negocio  'reset role; set request.jwt.claim.sub = ''00000000-0000-0000-0000-000000000012''; set role authenticated;'
\set como_nuevo    'reset role; set request.jwt.claim.sub = ''00000000-0000-0000-0000-000000000013''; set role authenticated;'
\set como_otro     'reset role; set request.jwt.claim.sub = ''00000000-0000-0000-0000-000000000099''; set role authenticated;'
\set como_visita   'reset role; set request.jwt.claim.sub = ''''; set role anon;'
\set como_admin    'reset role;'

\echo '--- 1. Alta de Ces.Art y de La Moneda (lo hace el dueño de la plataforma) ---'
:como_admin
insert into public.plataforma_miembros (user_id, nombre, rol) values
  ('00000000-0000-0000-0000-00000000000a', 'Ces.Art', 'dueno_plataforma');
:como_cesart
insert into public.plataforma_miembros (user_id, nombre, rol) values
  ('00000000-0000-0000-0000-00000000000c', 'César', 'cobrador');
insert into public.empresas (id, nombre, slug, abono_monto, abono_pagado_hasta) values
  ('10000000-0000-0000-0000-000000000001', 'La Moneda', 'la-moneda', 30000, date_trunc('month', now())::date),
  ('10000000-0000-0000-0000-000000000002', 'Otra Distribuidora', 'otra', 30000, date_trunc('month', now())::date);
insert into public.miembros (empresa_id, user_id, nombre, roles) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Dueño La Moneda', '{dueno}'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000099', 'Dueño Otra', '{dueno}');
\set QUIET 1
:como_admin
select test.ok((select count(*) from public.novedades_reglas where empresa_id = '10000000-0000-0000-0000-000000000001') = 5,
               'la distribuidora nueva trae su configuración y reglas de novedades');

:como_dueno
insert into public.miembros (empresa_id, user_id, nombre, roles) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Armador', '{armado}'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Catálogo', '{catalogo}');
update public.empresa_config set compra_minima = 30000, alias_transferencia = 'la.moneda.mp', titular = 'César'
 where empresa_id = '10000000-0000-0000-0000-000000000001';
select test.ok((select compra_minima from public.empresa_config where empresa_id = '10000000-0000-0000-0000-000000000001') = 30000,
               'el dueño edita la configuración');

-- Un cambio sin permiso no da error: simplemente no encuentra filas para cambiar
:como_armado
update public.empresa_config set compra_minima = 0 where empresa_id = '10000000-0000-0000-0000-000000000001';
:como_admin
select test.ok((select compra_minima from public.empresa_config where empresa_id = '10000000-0000-0000-0000-000000000001') = 30000,
               'quien arma pedidos NO puede cambiar la compra mínima');


\echo '--- 2. Carga inicial de los 441 productos reales de products-data.js ---'
:como_admin
create table test.datos as select pg_read_file(:'archivo')::jsonb as j;
grant select on test.datos to authenticated;
:como_catalogo
select test.ok((public.importar_productos('10000000-0000-0000-0000-000000000001', (select j from test.datos), true)->>'nuevos')::int
               = (select count(*) from test.datos, jsonb_array_elements(j) x where lower(x->>'TipoMuestra') <> 'poster'),
               'importación del Excel: todos los productos');
:como_admin
select test.ok((select count(*) from public.lineas where empresa_id = '10000000-0000-0000-0000-000000000001')
               = (select count(*) from test.datos, jsonb_array_elements(j) x where lower(x->>'TipoMuestra') = 'poster'), 'un grupo por cada poster');
select test.ok((select count(*) from public.productos where linea_id is not null) > 60, 'las variedades quedaron unidas a su poster');
select test.ok((select count(*) from public.productos p join public.lineas l on l.id = p.linea_id
                 where p.codigo in ('551','552','553') and l.codigo = '554') = 3, 'Arrabal mousse 551, 552 y 553 → poster 554');
select test.ok((select count(*) from public.producto_eventos) = 0, 'la carga inicial no genera novedades');
select test.ok((select count(*) from public.stock where cantidad is null) = (select count(*) from public.productos), 'el stock queda "sin cargar"');


\echo '--- 3. Catálogo público y modo "solo listado" ---'
:como_visita
select test.ok(jsonb_array_length(public.catalogo_publico('la-moneda')->'productos') > 400, 'un visitante ve el catálogo');
select test.ok((public.catalogo_publico('la-moneda')->'productos'->0->>'precio') is not null, 'en modo público ve precios');
:como_dueno
update public.empresa_config set modo_catalogo = 'solo_listado' where empresa_id = '10000000-0000-0000-0000-000000000001';
:como_visita
select test.ok((select bool_and(x->>'precio' is null) from jsonb_array_elements(public.catalogo_publico('la-moneda')->'productos') x),
               'en "solo listado" el visitante NO ve precios en el catálogo');
select test.ok((select count(*) from public.producto_precios) = 0, 'ni leyendo la tabla de precios directo');
:como_dueno
update public.empresa_config set modo_catalogo = 'publico_con_precios' where empresa_id = '10000000-0000-0000-0000-000000000001';


\echo '--- 4. Registro de clientes y pedido desde la app ---'
:como_hogar
select test.falla($$select public.registrar_cliente('10000000-0000-0000-0000-000000000001', 'Ana', '+5492346000011', 'hogar', null, null, null, true)$$,
                  'email_invalido', 'para crear la cuenta el email es obligatorio');
select public.registrar_cliente('10000000-0000-0000-0000-000000000001', 'Ana Hogar', '+5492346000011', 'hogar', null, null, 'Ana@Gmail.com', true);
:como_negocio
select public.registrar_cliente('10000000-0000-0000-0000-000000000001', 'Beto Kiosco', '+5492346000012', 'negocio', 'Kiosco Beto', null, 'beto@kiosco.com', true);

-- Precios de prueba conocidos
:como_catalogo
update public.producto_precios set precio = 1000, step = 1, precio_volumen = 900, presentacion_volumen = 'bulto',
       unidades_volumen = 10, minimo_volumen = 1
 where producto_id = (select id from public.productos where codigo = '449');
update public.producto_precios set precio = 2000, step = 1, precio_volumen = null, unidades_volumen = null
 where producto_id = (select id from public.productos where codigo = '164');
delete from public.ofertas where producto_id in (select id from public.productos where codigo in ('449','164'));

:como_hogar
select test.falla($$select public.crear_pedido('10000000-0000-0000-0000-000000000001',
   ('[{"producto_id": ' || (select id from public.productos where codigo='164') || ', "unidades": 2, "forma": 1}]')::jsonb,
   gen_random_uuid())$$, 'compra_minima', 'pedido por debajo de la compra mínima ($30.000)');
select test.falla($$select public.crear_pedido('10000000-0000-0000-0000-000000000001',
   ('[{"producto_id": ' || (select id from public.productos where codigo='449') || ', "unidades": 15, "forma": 2}]')::jsonb,
   gen_random_uuid())$$, 'cantidad_invalida', 'por bulto hay que pedir bultos completos (de a 10)');

select public.crear_pedido('10000000-0000-0000-0000-000000000001',
  jsonb_build_array(
    jsonb_build_object('producto_id', (select id from public.productos where codigo='449'), 'unidades', 20, 'forma', 2, 'precio_visto', 900),
    jsonb_build_object('producto_id', (select id from public.productos where codigo='164'), 'unidades', 8, 'forma', 1, 'precio_visto', 1900)),
  '20000000-0000-0000-0000-000000000001', 34000) as r \gset
select test.ok((:'r'::jsonb->>'total')::numeric = 20*900 + 8*2000, 'el servidor calcula el total con sus precios (20 u. por bulto a $900 + 8 u. a $2.000)');
select test.ok(jsonb_array_length(:'r'::jsonb->'diferencias') = 1, 'detecta que el cliente vio un precio distinto ($1.900 vs $2.000)');
select test.ok((public.crear_pedido('10000000-0000-0000-0000-000000000001', '[]', '20000000-0000-0000-0000-000000000001')->>'repetido')::boolean,
               'reenviar el mismo pedido sin señal no lo duplica');

:como_negocio
select test.ok((select count(*) from public.pedidos) = 0, 'otro cliente NO ve el pedido de Ana');
:como_otro
select test.ok((select count(*) from public.pedidos) = 0 and (select count(*) from public.clientes) = 0,
               'el dueño de OTRA distribuidora no ve pedidos ni clientes de La Moneda');
:como_cobrador
select test.ok((select count(*) from public.pedidos) = 0 and (select count(*) from public.clientes) = 0,
               'el cobrador no ve pedidos ni clientes');


\echo '--- 5. Limitar al stock (con dos pedidos al mismo tiempo) ---'
:como_dueno
select test.ok(not (public.activar_limite_stock('10000000-0000-0000-0000-000000000001', true)->>'activado')::boolean,
               'no se puede activar con productos sin stock cargado');
:como_admin
update public.stock set cantidad = 100 where cantidad is null;
update public.stock set cantidad = 30 where producto_id = (select id from public.productos where codigo = '449');
:como_dueno
select test.ok((public.activar_limite_stock('10000000-0000-0000-0000-000000000001', true)->>'activado')::boolean,
               'con todo el stock cargado, se activa');
:como_visita
select test.ok((select (x->>'maximo')::int from jsonb_array_elements(public.catalogo_publico('la-moneda')->'productos') x
                 where x->>'codigo' = '449') = 10, 'el catálogo muestra disponible = 30 − 20 ya pedidos = 10');
:como_negocio
select test.falla($$select public.crear_pedido('10000000-0000-0000-0000-000000000001',
   ('[{"producto_id": ' || (select id from public.productos where codigo='449') || ', "unidades": 40, "forma": 2}]')::jsonb,
   gen_random_uuid())$$, 'supera_stock', 'no puede pedir más que lo disponible');


\echo '--- 6. Armado del pedido de Ana ---'
:como_admin
insert into public.producto_costos (producto_id, empresa_id, costo)
select id, empresa_id, 700 from public.productos where codigo = '449';
insert into public.producto_costos (producto_id, empresa_id, costo)
select id, empresa_id, 1500 from public.productos where codigo = '164';
select id as pedido from public.pedidos where uuid_origen = '20000000-0000-0000-0000-000000000001' \gset
select i.id as item449 from public.pedido_items i join public.productos p on p.id = i.producto_id where p.codigo = '449' \gset
select i.id as item164 from public.pedido_items i join public.productos p on p.id = i.producto_id where p.codigo = '164' \gset

:como_armado
select test.ok((select count(*) from public.producto_costos) = 0, 'quien arma NO ve los costos');
select public.iniciar_armado(:pedido) \g /dev/null
select public.item_entregadas(:item164, 5) \g /dev/null
select test.ok((select marca_stock = 'sin_stock' and marca_auto from public.pedido_items where id = :item164),
               'entregar menos de lo pedido marca SIN STOCK solo');
select public.marcar_critico(:item449, 4) \g /dev/null
:como_admin
select test.ok((select cantidad from public.stock where producto_id = (select producto_id from public.pedido_items where id = :item449)) = 24,
               'confirmar "quedan 4" deja el stock en 4 + 20 de este pedido = 24 (se descuenta al enviar)');
select test.ok(exists (select 1 from public.lista_compras l join public.productos p on p.id = l.producto_id
                       where p.codigo = '449' and l.estado = 'pendiente' and l.motivo = 'critico'), 'CRÍTICO entra a la lista de compras');
:como_armado
select public.enviar_pedido(:pedido) as ticket \gset
select test.ok((:'ticket'::jsonb->>'total_redondeado')::numeric = 28000, 'total: 20×900 + 5×2.000 = $28.000 redondeado a $100');
select test.ok(jsonb_array_length(:'ticket'::jsonb->'faltantes') = 1, 'el ticket lista el faltante (3 u.)');
:como_admin
select test.ok((select cantidad from public.stock where producto_id = (select producto_id from public.pedido_items where id = :item449)) = 4, 'stock descontado: quedan 4');
select test.ok((select marca from public.stock where producto_id = (select producto_id from public.pedido_items where id = :item164)) = 'sin_stock', 'el producto quedó SIN STOCK para los demás');
select test.ok((select count(*) from public.avisarme where estado = 'esperando' and cantidad = 3) = 1, 'el faltante de 3 u. quedó guardado para Ana');
select test.ok((select count(*) from public.pedido_items_costos) = 2, 'se congelaron los costos para las utilidades');
:como_negocio
select test.falla($$select public.crear_pedido('10000000-0000-0000-0000-000000000001',
   ('[{"producto_id": ' || (select id from public.productos where codigo='164') || ', "unidades": 20, "forma": 1}]')::jsonb,
   gen_random_uuid())$$, 'sin_stock', 'un cliente no puede pedir un producto SIN STOCK');

-- El SIN STOCK no se va con un ajuste: solo con una compra
:como_catalogo
select public.ajustar_stock((select id from public.productos where codigo='164'), 50);
:como_admin
select test.ok((select marca from public.stock where producto_id = (select id from public.productos where codigo='164')) = 'sin_stock',
               'un ajuste de stock NO quita la marca SIN STOCK');


\echo '--- 7. Compra que repone ---'
:como_catalogo
select public.crear_compra('10000000-0000-0000-0000-000000000001') as compra \gset
insert into public.compra_items (compra_id, empresa_id, producto_id, cantidad, costo_unitario)
select :compra, empresa_id, id, 24, 1800 from public.productos where codigo = '164';   -- mark-up 11%: aviso
insert into public.compra_items (compra_id, empresa_id, producto_id, cantidad, costo_unitario)
select :compra, empresa_id, id, 10, 700 from public.productos where codigo = '449';
select public.registrar_compra(:compra) as rc \gset
select test.ok(jsonb_array_length(:'rc'::jsonb->'debajo_del_minimo') = 1, 'aviso de mark-up debajo del 20% (2.000 / 1.800 − 1 = 11%)');
select test.ok((:'rc'::jsonb->>'total')::numeric = 24*1800 + 10*700, 'total de la factura');
select test.ok((:'rc'::jsonb->>'utilidad_esperada')::numeric = 24*(2000-1800) + 10*(900-700), 'utilidad esperada de la factura');
:como_admin
select test.ok((select marca from public.stock where producto_id = (select id from public.productos where codigo='164')) = 'disponible', 'la compra vuelve el producto a DISPONIBLE');
select test.ok((select marca from public.stock where producto_id = (select id from public.productos where codigo='449')) = 'disponible', 'y le quita el CRÍTICO');
select test.ok(not exists (select 1 from public.lista_compras l join public.productos p on p.id = l.producto_id
                           where p.codigo in ('449','164') and l.estado <> 'resuelto'), 'los productos comprados salen de la lista de compras');
select test.ok((select count(*) from public.avisarme where estado = 'avisado') = 1, 'Ana queda avisada de su faltante');
select test.ok((select count(*) from public.producto_eventos where tipo = 'reingreso') = 1, 'novedad "reingreso"');
:como_catalogo
select test.ok((select count(*) from public.compra_items where compra_id = :compra) = 2, 'quien carga compras ve sus renglones');
update public.compra_items set cantidad = 999 where compra_id = :compra;
:como_admin
select test.ok((select max(cantidad) from public.compra_items where compra_id = :compra) = 24, 'una compra registrada ya no se puede modificar');


\echo '--- 8. Faltante que vuelve: sin compra mínima y al precio original ---'
:como_hogar
select test.ok((select grupo from public.mis_novedades('10000000-0000-0000-0000-000000000001') limit 1) = 'avisarme',
               'arriba de todo de las novedades: lo que le faltó y volvió');
select avisarme_id as av, precio_faltante as pf from public.mis_novedades('10000000-0000-0000-0000-000000000001') where grupo = 'avisarme' \gset
:como_catalogo
update public.producto_precios set precio = 2200 where producto_id = (select id from public.productos where codigo='164');
:como_hogar
select public.crear_pedido('10000000-0000-0000-0000-000000000001',
  jsonb_build_array(jsonb_build_object('producto_id', (select id from public.productos where codigo='164'),
                                       'unidades', 3, 'forma', 1, 'avisarme_id', :av)),
  gen_random_uuid()) as rf \gset
select test.ok((:'rf'::jsonb->>'total')::numeric = 6000, 'el faltante se envía solo ($6.000 < mínimo) y a $2.000 (el precio original, hoy está $2.200)');


\echo '--- 9. Novedades según el perfil ---'
:como_negocio
select test.ok(exists (select 1 from public.mis_novedades('10000000-0000-0000-0000-000000000001') where tipo = 'precio_sube'),
               'el comerciante ve la suba de precio');
:como_hogar
select test.ok(not exists (select 1 from public.mis_novedades('10000000-0000-0000-0000-000000000001') where tipo = 'precio_sube'),
               'el cliente de hogar NO ve subas de precio');
select public.borrar_novedades('10000000-0000-0000-0000-000000000001');
select test.ok(not exists (select 1 from public.mis_novedades('10000000-0000-0000-0000-000000000001') where grupo <> 'avisarme'),
               '"¿Querés borrar todas las novedades?" → sí: no le vuelven a aparecer');


\echo '--- 10. Pedido por WhatsApp de alguien sin cuenta ---'
:como_armado
select public.pegar_pedido('10000000-0000-0000-0000-000000000001', 'Carla', '+5492346000013',
  jsonb_build_array(jsonb_build_object('producto_id', (select id from public.productos where codigo='449'), 'unidades', 10, 'forma', 2)));
:como_nuevo
select public.registrar_cliente('10000000-0000-0000-0000-000000000001', 'Carla', '+5492346000013', 'hogar', null, null, 'carla@mail.com', true);
select test.ok((select count(*) from public.clientes) = 1, 'al registrarse usa la misma ficha (no duplica)');
select test.ok((select count(*) from public.pedidos) = 0, 'pero no ve el pedido de WhatsApp hasta que la distribuidora verifique su teléfono');
:como_armado
select public.verificar_telefono((select id from public.clientes where telefono = '+5492346000013'));
:como_nuevo
select test.ok((select count(*) from public.pedidos) = 1, 'verificado el teléfono, ve su historial');


\echo '--- 11. Abono y cobro en efectivo con código ---'
:como_dueno
select public.mi_abono('10000000-0000-0000-0000-000000000001') as ab \gset
select test.ok(length(:'ab'::jsonb->>'codigo') = 4, 'el dueño ve su código de pago');
:como_cobrador
select test.falla($$select public.cobro_preview('10000000-0000-0000-0000-000000000001')$$, 'sin_permiso',
                  'un cobrador sin esa distribuidora asignada no puede cobrarle');
:como_cesart
insert into public.cobrador_empresas values ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001');
:como_cobrador
select test.ok((select count(*) from public.codigos_pago_abono) = 0, 'el cobrador NO puede leer el código');
select test.ok(not (public.registrar_cobro_efectivo('10000000-0000-0000-0000-000000000001', 'ZZZZ')->>'ok')::boolean, 'código equivocado: no cobra');
select public.registrar_cobro_efectivo('10000000-0000-0000-0000-000000000001', lower(:'ab'::jsonb->>'codigo')) as cobro \gset
select test.ok((:'cobro'::jsonb->>'ok')::boolean and (:'cobro'::jsonb->>'recibo')::int = 1001, 'código correcto: pago registrado con recibo #1001');
:como_admin
select test.ok((select abono_pagado_hasta from public.empresas where slug = 'la-moneda') = (:'ab'::jsonb->>'mes_hasta')::date, 'el abono queda pagado hasta el mes cobrado');
:como_cobrador
select public.crear_rendicion() as ren \gset
select test.ok((:'ren'::jsonb->>'monto')::numeric = 30000, 'rendición del cobrador: $30.000');
:como_cesart
select public.confirmar_rendicion((:'ren'::jsonb->>'rendicion')::bigint, 30000);
select test.ok((select estado from public.rendiciones) = 'confirmada', 'Ces.Art confirma la rendición');


\echo '--- 12. Calendario del abono ---'
:como_admin
update public.empresas set abono_pagado_hasta = (date_trunc('month', now()) - interval '1 month')::date where slug = 'otra';
select test.ok(public.estado_abono('10000000-0000-0000-0000-000000000002') in ('al_dia', 'recordatorio', 'alerta'),
               'mes anterior pago: al día / recordatorio / alerta según el día');
update public.empresas set abono_pagado_hasta = (date_trunc('month', now()) - interval '3 month')::date where slug = 'otra';
select test.ok(public.estado_abono('10000000-0000-0000-0000-000000000002') = 'catalogo_oculto', 'tres meses sin pagar: catálogo oculto');
:como_visita
select test.ok(public.catalogo_publico('otra')->>'estado' = 'catalogo_oculto', 'el visitante ve "catálogo no disponible"');
:como_admin
update public.empresas set estado_manual = 'cortesia', cortesia_hasta = current_date + 30 where slug = 'otra';
select test.ok(public.estado_abono('10000000-0000-0000-0000-000000000002') = 'al_dia', 'cortesía: habilitada sin cargar un pago falso');


\echo '--- 13. Informes ---'
:como_dueno
select test.ok((select sum(utilidad) from public.informe_ventas('10000000-0000-0000-0000-000000000001', current_date - 1, current_date + 1))
               = 20*(900-700) + 5*(2000-1500), 'utilidad real de lo vendido: 20×$200 + 5×$500');
:como_armado
select test.falla($$select * from public.informe_ventas('10000000-0000-0000-0000-000000000001', current_date - 1, current_date + 1)$$,
                  'sin_permiso', 'quien arma NO ve informes de utilidades');


\echo '--- 14. Atajos que no tienen que funcionar ---'
:como_armado
select test.falla($$update public.pedidos set total_final = 1, estado = 'entregado'$$, 'permission denied for table pedidos',
                  'quien arma NO puede cambiar totales ni estados a mano (solo con las funciones)');
update public.pedidos set notas_internas = 'tocar timbre' where id = :pedido;
:como_admin
select test.ok((select notas_internas from public.pedidos where id = :pedido) = 'tocar timbre', 'pero sí escribir notas internas');
:como_dueno
select public.activar_limite_stock('10000000-0000-0000-0000-000000000001', false) \g /dev/null
select test.falla($$update public.empresa_config set limitar_al_stock = true
                    where empresa_id = '10000000-0000-0000-0000-000000000001'$$, 'usar_activar_limite_stock',
                  '"Limitar al stock" no se enciende salteando la auditoría');
select test.falla($$update public.empresa_config set faltantes_vencen_dias = 30
                    where empresa_id = '10000000-0000-0000-0000-000000000001'$$, '*',
                  'el vencimiento de faltantes no puede pasar de 7 días');
update public.empresa_config set modo_catalogo = 'solo_listado' where empresa_id = '10000000-0000-0000-0000-000000000001';
:como_hogar
select test.falla($$select public.precio_producto(1, 1, 1, current_date)$$, 'permission denied for function precio_producto',
                  'nadie puede consultar precios por fuera del catálogo');
select test.falla($$update public.clientes set estado = 'aprobado'$$, 'permission denied for table clientes',
                  'un cliente no puede auto-aprobarse');
:como_negocio
select test.ok((select count(*) from public.stock) = 0 and (select count(*) from public.producto_eventos) = 0,
               'un cliente no lee el stock ni el historial interno');


\echo '--- 15. Recuperar la clave por email ---'
:como_hogar
select test.falla($$select public.crear_codigo_reset_email('10000000-0000-0000-0000-000000000001', '+5492346000011')$$,
                  'permission denied for function crear_codigo_reset_email', 'solo el servidor puede pedir el código');
:como_admin
set role service_role;
select test.ok(public.crear_codigo_reset_email('10000000-0000-0000-0000-000000000001', '+5490000000000') is null,
               'celular sin cuenta: no revela nada');
select public.crear_codigo_reset_email('10000000-0000-0000-0000-000000000001', '+5492346000011') as rc1 \gset
select test.ok(:'rc1'::jsonb->>'email' = 'ana@gmail.com' and :'rc1'::jsonb->>'email_tapado' = 'a***@gmail.com',
               'el código va al email de Ana (guardado en minúsculas) y la app muestra a***@gmail.com');
select test.ok(public.validar_codigo_reset('10000000-0000-0000-0000-000000000001', '+5492346000011', 'XXXXXX') is null, 'código equivocado: no entra');
select test.ok(public.validar_codigo_reset('10000000-0000-0000-0000-000000000001', '+5492346000011', lower(:'rc1'::jsonb->>'codigo'))
               = '00000000-0000-0000-0000-000000000011', 'código correcto: se puede poner clave nueva');
select test.falla($$select public.validar_codigo_reset('10000000-0000-0000-0000-000000000001', '+5492346000011', '$$ || (:'rc1'::jsonb->>'codigo') || $$')$$,
                  'codigo_invalido', 'un código usado no sirve dos veces');
select public.crear_codigo_reset_email('10000000-0000-0000-0000-000000000001', '+5492346000011') \g /dev/null
select public.crear_codigo_reset_email('10000000-0000-0000-0000-000000000001', '+5492346000011') \g /dev/null
select test.falla($$select public.crear_codigo_reset_email('10000000-0000-0000-0000-000000000001', '+5492346000011')$$,
                  'demasiados_pedidos', 'máximo 3 mails por hora para el mismo celular');
:como_admin
update public.codigos_reset set vence = now() - interval '1 minute';
set role service_role;
select test.falla($$select public.validar_codigo_reset('10000000-0000-0000-0000-000000000001', '+5492346000011', 'ABCDEF')$$,
                  'codigo_invalido', 'el código vence a los 15 minutos');
:como_hogar
select public.cambiar_mi_email('10000000-0000-0000-0000-000000000001', 'ana.nueva@gmail.com') \g /dev/null
select test.ok((select email from public.clientes) = 'ana.nueva@gmail.com', 'el cliente puede corregir su email');

:como_admin
\echo 'TODAS LAS PRUEBAS PASARON'
