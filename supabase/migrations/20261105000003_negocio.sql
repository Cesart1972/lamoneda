-- =========================================================
-- 3. FUNCIONES DEL NEGOCIO
-- ---------------------------------------------------------
-- La lógica que no puede quedar en el celular.
-- Todas controlan permisos adentro y fallan con un código corto
-- (error_app) que la app traduce a un mensaje amable.
--
--   Precios .............. precio_producto
--   Catálogo ............. catalogo_publico
--   Pedidos (cliente) .... crear_pedido
--   Armado ............... pegar_pedido, iniciar_armado, item_entregadas,
--                          item_hecho, agregar_item, quitar_item,
--                          marcar_critico, marcar_sin_stock, quitar_marca,
--                          enviar_pedido, cambiar_estado_pedido, marcar_pago
--   Stock ................ ajustar_stock, cambiar_marca, activar_limite_stock
--   Compras .............. crear_compra, comprar_desde_lista, registrar_compra
--   Clientes ............. registrar_cliente, aprobar_cliente, verificar_telefono,
--                          generar_codigo_reset, validar_codigo_reset
--   Faltantes y avisos ... avisame, descartar_faltante, clientes_con_faltantes
--   Novedades ............ mis_novedades, borrar_novedades
--   Abono y cobros ....... mi_abono, codigo_pago, cobro_preview,
--                          registrar_cobro_efectivo, crear_rendicion, confirmar_rendicion
--   Informes ............. informe_ventas, informe_productos
--   Excel ................ importar_productos
-- =========================================================


-- =========================================================
-- PRECIOS
-- Misma regla que js/formas-compra.js:
--  · Forma 1: precio por unidad (o el de oferta), de a "step" unidades.
--  · Oferta vigente (hoy, o rebaja permanente): menor que el precio y no mayor
--    que el precio por volumen. Con oferta no hay forma 2.
--  · Forma 2 (volumen): existe si unidades_volumen > step (o = step con mínimo > 1)
--    y precio_volumen no es mayor que el precio. Se compra de a unidades_volumen,
--    con mínimo minimo_volumen. Sin precio_volumen es un atajo al mismo precio.
-- El PrecioPorVolumen lo carga la distribuidora: acá solo se elige cuál aplica.
-- =========================================================
create or replace function public.precio_producto(
  p_producto bigint, p_forma int, p_unidades int, p_fecha date,
  out precio numeric, out origen text, out oferta_fecha date, out ok boolean, out motivo text)
language plpgsql stable security definer set search_path = public as $$
declare
  pp producto_precios;
  v_oferta numeric;
  v_oferta_fecha date;
  v_hay_forma2 boolean;
begin
  ok := false;
  select * into pp from producto_precios where producto_id = p_producto;
  if not found then motivo := 'sin_precio'; return; end if;

  select o.precio_oferta, o.fecha into v_oferta, v_oferta_fecha
    from ofertas o
   where o.producto_id = p_producto and o.activa
     and (o.fecha = p_fecha or o.fecha is null)
   order by o.fecha nulls last limit 1;
  if v_oferta is not null and not (v_oferta < pp.precio
       and (pp.precio_volumen is null or v_oferta <= pp.precio_volumen)) then
    v_oferta := null;   -- oferta mal cargada: se ignora (como en la app)
  end if;

  v_hay_forma2 := v_oferta is null
    and pp.unidades_volumen is not null
    and (pp.precio_volumen is null or pp.precio_volumen <= pp.precio)
    and (pp.unidades_volumen > pp.step or (pp.unidades_volumen = pp.step and coalesce(pp.minimo_volumen, 1) > 1));

  if p_unidades is null or p_unidades <= 0 then motivo := 'cantidad_invalida'; return; end if;

  if p_forma = 2 then
    if not v_hay_forma2 then motivo := 'sin_forma_volumen'; return; end if;
    if p_unidades % pp.unidades_volumen <> 0
       or p_unidades < pp.unidades_volumen * coalesce(pp.minimo_volumen, 1) then
      motivo := 'cantidad_invalida'; return;
    end if;
    precio := coalesce(pp.precio_volumen, pp.precio);
    origen := 'volumen';
  else
    if p_unidades % pp.step <> 0 then motivo := 'cantidad_invalida'; return; end if;
    if v_oferta is not null then
      precio := v_oferta; origen := 'oferta'; oferta_fecha := v_oferta_fecha;
    else
      precio := pp.precio; origen := 'lista';
    end if;
  end if;
  ok := true;
end $$;


-- =========================================================
-- CATÁLOGO PARA LA APP
-- Reemplaza a products-data.js (que queda como respaldo sin conexión).
-- Sin precios si el modo es "solo listado" y quien mira no es cliente aprobado.
-- =========================================================
create or replace function public.catalogo_publico(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e        empresas;
  c        empresa_config;
  v_estado text;
  v_precios boolean;
  v_hoy    date;
  v_res    jsonb;
begin
  select * into e from empresas where slug = p_slug;
  if not found then perform public.error_app('empresa_inexistente'); end if;
  select * into c from empresa_config where empresa_id = e.id;
  v_estado := public.estado_abono(e.id);

  if v_estado = 'catalogo_oculto' and not public.es_miembro(e.id) then
    return jsonb_build_object('estado', 'catalogo_oculto', 'empresa', jsonb_build_object('nombre', e.nombre));
  end if;

  v_precios := public.puede_ver_precios(e.id);
  v_hoy := public.hoy(e.id);

  select jsonb_build_object(
    'estado', v_estado,
    'hoy', v_hoy,
    'ver_precios', v_precios,
    'pedidos_habilitados', v_estado not in ('suspendida', 'catalogo_oculto'),
    'empresa', jsonb_build_object(
      'id', e.id, 'nombre', e.nombre, 'slug', e.slug, 'plan', e.plan,
      'modo_catalogo', c.modo_catalogo,
      'compra_minima', case when v_precios then c.compra_minima end,
      'redondeo', c.redondeo, 'whatsapp', c.whatsapp_numero,
      'alias', case when v_precios then c.alias_transferencia end,
      'horario_atencion', c.horario_atencion,
      'hace_envios', c.hace_envios and e.plan = 'pro', 'retiro_en_local', c.retiro_en_local,
      'local', jsonb_build_object('direccion', c.local_direccion, 'localidad', c.local_localidad,
                'referencias', c.local_referencias, 'lat', c.local_lat, 'lng', c.local_lng,
                'horario', c.local_horario, 'foto', c.local_foto),
      'limitar_al_stock', c.limitar_al_stock,
      'apariencia', c.apariencia),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object(
        'id', k.id, 'nombre', k.nombre, 'orden', k.orden,
        'separador_imagen', k.separador_imagen, 'separador_texto', k.separador_texto) order by k.orden)
      from categorias k where k.empresa_id = e.id), '[]'),
    'grupos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.id, 'codigo', l.codigo, 'nombre', l.nombre, 'imagen', l.imagen,
        'destacado', l.destacado, 'orden', l.orden, 'categoria_id', l.categoria_id) order by l.orden)
      from lineas l where l.empresa_id = e.id), '[]'),
    'proveedores_grupo', coalesce((select jsonb_agg(jsonb_build_object(
        'id', pv.id, 'nombre', pv.nombre, 'monto_minimo', pv.cg_monto_minimo,
        'icono', pv.cg_icono, 'condiciones', pv.cg_condiciones, 'orden', pv.cg_orden))
      from proveedores pv where pv.empresa_id = e.id and pv.cg_activa and v_precios), '[]'),
    'productos', coalesce((select jsonb_agg(x.p order by x.orden) from (
      select p.orden, jsonb_strip_nulls(jsonb_build_object(
        'id', p.id, 'codigo', p.codigo, 'nombre', p.nombre, 'marca', p.marca,
        'categoria_id', p.categoria_id, 'grupo_id', p.linea_id,
        'proveedor_id', case when pv.cg_activa then p.proveedor_id end,
        'keywords', p.keywords, 'etiquetas', p.etiquetas, 'cinta', p.cinta,
        'destacado', p.destacado, 'orden', p.orden,
        'imagen', p.imagen, 'imagen_version', p.imagen_version,
        'sin_stock', (s.marca = 'sin_stock'
                      or (c.limitar_al_stock and coalesce(d.disponible, 0) <= 0)),
        'maximo', case when c.limitar_al_stock then greatest(coalesce(d.disponible, 0), 0) end,
        'precio', case when v_precios then pp.precio end,
        'step', pp.step,
        'presentacion_venta', pp.presentacion_venta,
        'precio_volumen', case when v_precios then pp.precio_volumen end,
        'presentacion_volumen', pp.presentacion_volumen,
        'unidades_volumen', pp.unidades_volumen,
        'minimo_volumen', pp.minimo_volumen,
        'oferta', case when v_precios and o.precio_oferta is not null
                       then jsonb_build_object('precio', o.precio_oferta, 'fecha', o.fecha) end
      )) as p
      from productos p
      left join producto_precios pp on pp.producto_id = p.id
      left join stock s on s.producto_id = p.id
      left join proveedores pv on pv.id = p.proveedor_id
      left join lateral (
        select s.cantidad - coalesce((select sum(i.pedidas) from pedido_items i
                                        join pedidos pe on pe.id = i.pedido_id
                                       where i.producto_id = p.id and pe.estado in ('nuevo', 'armando')), 0) as disponible
      ) d on true
      left join lateral (
        select o.precio_oferta, o.fecha from ofertas o
         where o.producto_id = p.id and o.activa and (o.fecha = v_hoy or o.fecha is null)
           and o.precio_oferta < pp.precio
           and (pp.precio_volumen is null or o.precio_oferta <= pp.precio_volumen)
         order by o.fecha nulls last limit 1
      ) o on true
      where p.empresa_id = e.id and p.visible
    ) x), '[]')
  ) into v_res;

  return v_res;
end $$;


-- =========================================================
-- PEDIDOS: EL CLIENTE ENVÍA SU PEDIDO DESDE LA APP
-- p_items: [{ "producto_id": 12, "unidades": 20, "forma": 2,
--             "precio_visto": 1079, "avisarme_id": null }]
-- =========================================================
create or replace function public.crear_pedido(
  p_empresa uuid, p_items jsonb, p_uuid uuid,
  p_total_visto numeric default null, p_notas text default null, p_tipo_entrega text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c           empresa_config;
  cli         clientes;
  v_pedido    bigint;
  v_numero    int;
  v_hoy       date := public.hoy(p_empresa);
  v_item      jsonb;
  v_prod      productos;
  v_st        stock;
  v_pr        record;
  v_av        avisarme;
  v_disp      int;
  v_total     numeric := 0;
  v_faltantes boolean := false;
  v_dif       jsonb := '[]';
  v_lineas    jsonb := '[]';
  v_linea     jsonb;
  v_grupo     record;
begin
  -- Reenvío del mismo pedido (sin señal): devuelve el que ya existe
  select id, numero into v_pedido, v_numero from pedidos where uuid_origen = p_uuid;
  if found then
    return jsonb_build_object('pedido_id', v_pedido, 'numero', v_numero, 'repetido', true);
  end if;

  select * into cli from clientes where empresa_id = p_empresa and user_id = auth.uid();
  if not found then perform public.error_app('registrate_primero'); end if;
  if cli.estado <> 'aprobado' then perform public.error_app('cliente_no_habilitado', jsonb_build_object('estado', cli.estado)); end if;
  if public.estado_abono(p_empresa) in ('suspendida', 'catalogo_oculto') then
    perform public.error_app('pedidos_suspendidos');
  end if;
  select * into c from empresa_config where empresa_id = p_empresa;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then perform public.error_app('pedido_vacio'); end if;

  -- Bloquea el stock de esos productos (en orden) para que dos pedidos no se pisen
  perform 1 from stock s
   where s.producto_id in (select (x->>'producto_id')::bigint from jsonb_array_elements(p_items) x)
   order by s.producto_id for update;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from productos
     where id = (v_item->>'producto_id')::bigint and empresa_id = p_empresa and visible;
    if not found then perform public.error_app('producto_inexistente', v_item); end if;
    select * into v_st from stock where producto_id = v_prod.id;

    -- Faltante guardado de un pedido anterior
    if v_item->>'avisarme_id' is not null then
      select * into v_av from avisarme
       where id = (v_item->>'avisarme_id')::bigint and cliente_id = cli.id
         and producto_id = v_prod.id and estado = 'avisado' and (vence is null or vence > now());
      if not found then perform public.error_app('faltante_no_disponible', v_item); end if;
    else
      v_av := null;
    end if;

    if v_st.marca = 'sin_stock' then perform public.error_app('sin_stock', jsonb_build_object('producto', v_prod.nombre)); end if;

    if v_av.id is not null and c.faltantes_precio = 'original' and v_av.precio_unitario is not null then
      select v_av.precio_unitario as precio, 'faltante'::text as origen, null::date as oferta_fecha,
             true as ok, null::text as motivo into v_pr;
      v_faltantes := true;
    else
      select * into v_pr from public.precio_producto(v_prod.id, coalesce((v_item->>'forma')::int, 1),
                                                     (v_item->>'unidades')::int, v_hoy);
      if not v_pr.ok then perform public.error_app(v_pr.motivo, jsonb_build_object('producto', v_prod.nombre)); end if;
      if v_av.id is not null then v_faltantes := true; v_pr.origen := 'faltante'; end if;
    end if;

    if c.limitar_al_stock then
      select coalesce(v_st.cantidad, 0) - coalesce(sum(i.pedidas), 0) into v_disp
        from pedido_items i join pedidos pe on pe.id = i.pedido_id
       where i.producto_id = v_prod.id and pe.estado in ('nuevo', 'armando');
      if (v_item->>'unidades')::int > v_disp then
        perform public.error_app('supera_stock', jsonb_build_object('producto', v_prod.nombre, 'maximo', greatest(v_disp, 0)));
      end if;
    end if;

    v_lineas := v_lineas || jsonb_build_object(
      'producto_id', v_prod.id, 'nombre', v_prod.nombre, 'orden', v_prod.orden,
      'proveedor_id', v_prod.proveedor_id,
      'forma', coalesce((v_item->>'forma')::int, 1), 'unidades', (v_item->>'unidades')::int,
      'precio', v_pr.precio, 'origen', v_pr.origen, 'oferta_fecha', v_pr.oferta_fecha,
      'precio_visto', (v_item->>'precio_visto')::numeric, 'avisarme_id', v_av.id);
  end loop;

  -- Compra x grupo: si lo de un proveedor llega al mínimo, esos productos van a PrecioPorVolumen
  for v_grupo in
    select pv.id, pv.cg_monto_minimo
      from proveedores pv
     where pv.empresa_id = p_empresa and pv.cg_activa and pv.cg_monto_minimo is not null
  loop
    if (select coalesce(sum((l->>'precio')::numeric * (l->>'unidades')::int), 0)
          from jsonb_array_elements(v_lineas) l
         where (l->>'proveedor_id')::bigint = v_grupo.id and l->>'origen' = 'lista') >= v_grupo.cg_monto_minimo then
      select coalesce(jsonb_agg(
               case when (l->>'proveedor_id')::bigint = v_grupo.id and l->>'origen' = 'lista'
                         and pp.precio_volumen is not null
                    then l || jsonb_build_object('precio', pp.precio_volumen, 'origen', 'grupo')
                    else l end), '[]')
        into v_lineas
        from jsonb_array_elements(v_lineas) l
        left join producto_precios pp on pp.producto_id = (l->>'producto_id')::bigint;
    end if;
  end loop;

  select coalesce(sum((l->>'precio')::numeric * (l->>'unidades')::int), 0) into v_total
    from jsonb_array_elements(v_lineas) l;

  if v_total < c.compra_minima and not (v_faltantes and c.faltantes_sin_minimo) then
    perform public.error_app('compra_minima', jsonb_build_object('minimo', c.compra_minima, 'total', v_total));
  end if;

  v_numero := public.siguiente_numero(p_empresa, 'pedido');
  insert into pedidos (empresa_id, numero, cliente_id, cliente_nombre, cliente_telefono, origen,
                       tipo_entrega, incluye_faltantes, total_cliente, total_calculado, notas_cliente, uuid_origen)
  values (p_empresa, v_numero, cli.id, cli.nombre, cli.telefono, 'app',
          case when c.hace_envios then coalesce(p_tipo_entrega, cli.entrega_preferida) end,
          v_faltantes, p_total_visto, v_total, p_notas, p_uuid)
  returning id into v_pedido;

  for v_linea in select * from jsonb_array_elements(v_lineas) loop
    insert into pedido_items (pedido_id, empresa_id, producto_id, orden, nombre, forma, medida,
                              unidades_por_paso, pedidas, entregadas, precio_unitario, precio_visto_cliente,
                              origen_precio, oferta_fecha, avisarme_id)
    select v_pedido, p_empresa, pp.producto_id, (v_linea->>'orden')::int, v_linea->>'nombre',
           (v_linea->>'forma')::int,
           case when (v_linea->>'forma')::int = 2 then pp.presentacion_volumen else pp.presentacion_venta end,
           case when (v_linea->>'forma')::int = 2 then pp.unidades_volumen else pp.step end,
           (v_linea->>'unidades')::int, (v_linea->>'unidades')::int,
           (v_linea->>'precio')::numeric, (v_linea->>'precio_visto')::numeric,
           v_linea->>'origen', (v_linea->>'oferta_fecha')::date, (v_linea->>'avisarme_id')::bigint
      from producto_precios pp where pp.producto_id = (v_linea->>'producto_id')::bigint;

    if (v_linea->>'precio_visto') is not null
       and (v_linea->>'precio_visto')::numeric <> (v_linea->>'precio')::numeric then
      v_dif := v_dif || jsonb_build_object('producto', v_linea->>'nombre',
                                           'visto', v_linea->'precio_visto', 'real', v_linea->'precio');
    end if;
    if v_linea->>'avisarme_id' is not null then
      update avisarme set estado = 'agregado' where id = (v_linea->>'avisarme_id')::bigint;
    end if;
  end loop;

  insert into pedido_eventos (pedido_id, empresa_id, tipo, detalle, usuario)
  values (v_pedido, p_empresa, 'creado', jsonb_build_object('origen', 'app', 'diferencias', v_dif), auth.uid());

  return jsonb_build_object('pedido_id', v_pedido, 'numero', v_numero, 'total', v_total, 'diferencias', v_dif);
end $$;


-- =========================================================
-- ARMADO (panel de la distribuidora)
-- =========================================================

create or replace function public.chequear_armado(p_empresa uuid)
returns void language plpgsql stable as $$
begin
  if not public.tiene_rol(p_empresa, '{dueno,encargado,armado}') then perform public.error_app('sin_permiso'); end if;
end $$;

-- Pedido que llegó por WhatsApp de alguien (con o sin cuenta). Precios de la app.
-- p_items: [{ "producto_id": 12, "unidades": 20, "forma": 2, "oferta_fecha": "2026-11-02" }]
create or replace function public.pegar_pedido(
  p_empresa uuid, p_nombre text, p_telefono text, p_items jsonb, p_notas text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cli    bigint;
  v_pedido bigint;
  v_numero int;
  v_item   jsonb;
  v_pr     record;
  v_fecha  date;
  v_total  numeric := 0;
  v_nombre text;
begin
  perform public.chequear_armado(p_empresa);
  select id into v_cli from clientes where empresa_id = p_empresa and telefono = p_telefono;
  if not found then
    insert into clientes (empresa_id, nombre, telefono, estado)
    values (p_empresa, p_nombre, p_telefono, 'sin_cuenta') returning id into v_cli;
  end if;
  select nombre into v_nombre from clientes where id = v_cli;

  v_numero := public.siguiente_numero(p_empresa, 'pedido');
  insert into pedidos (empresa_id, numero, cliente_id, cliente_nombre, cliente_telefono, origen, estado,
                       notas_cliente, armado_por, armado_inicio)
  values (p_empresa, v_numero, v_cli, v_nombre, p_telefono, 'whatsapp', 'armando',
          p_notas, auth.uid(), now())
  returning id into v_pedido;

  for v_item in select * from jsonb_array_elements(p_items) loop
    -- Si el ticket dice "Oferta dd/mm" y ese día existía esa oferta, se respeta
    v_fecha := coalesce((v_item->>'oferta_fecha')::date, public.hoy(p_empresa));
    select * into v_pr from public.precio_producto((v_item->>'producto_id')::bigint,
                         coalesce((v_item->>'forma')::int, 1), (v_item->>'unidades')::int, v_fecha);
    if not v_pr.ok then
      -- Cantidad que no respeta el step: se toma por unidad al precio de lista
      select pp.precio as precio, 'lista' as origen, null::date as oferta_fecha into v_pr
        from producto_precios pp where pp.producto_id = (v_item->>'producto_id')::bigint;
    end if;
    insert into pedido_items (pedido_id, empresa_id, producto_id, orden, nombre, forma, medida,
                              unidades_por_paso, pedidas, entregadas, precio_unitario, origen_precio, oferta_fecha)
    select v_pedido, p_empresa, p.id, p.orden, p.nombre, coalesce((v_item->>'forma')::int, 1),
           case when (v_item->>'forma')::int = 2 then pp.presentacion_volumen else pp.presentacion_venta end,
           case when (v_item->>'forma')::int = 2 then pp.unidades_volumen else pp.step end,
           (v_item->>'unidades')::int, (v_item->>'unidades')::int, v_pr.precio, v_pr.origen, v_pr.oferta_fecha
      from productos p join producto_precios pp on pp.producto_id = p.id
     where p.id = (v_item->>'producto_id')::bigint and p.empresa_id = p_empresa
    on conflict (pedido_id, producto_id) do update
      set pedidas = pedido_items.pedidas + excluded.pedidas,
          entregadas = pedido_items.entregadas + excluded.entregadas;
    v_total := v_total + v_pr.precio * (v_item->>'unidades')::int;
  end loop;

  update pedidos set total_calculado = v_total where id = v_pedido;
  insert into pedido_eventos (pedido_id, empresa_id, tipo, detalle, usuario)
  values (v_pedido, p_empresa, 'creado', '{"origen":"whatsapp"}', auth.uid());
  return jsonb_build_object('pedido_id', v_pedido, 'numero', v_numero, 'total', v_total);
end $$;

create or replace function public.pedido_para_armar(p_item bigint, out p pedidos, out i pedido_items)
language plpgsql security definer set search_path = public as $$
begin
  select * into i from pedido_items where id = p_item;
  if not found then perform public.error_app('item_inexistente'); end if;
  select * into p from pedidos where id = i.pedido_id for update;
  perform public.chequear_armado(p.empresa_id);
  if p.estado not in ('nuevo', 'armando') then perform public.error_app('pedido_cerrado'); end if;
  if p.estado = 'nuevo' then
    update pedidos set estado = 'armando', armado_por = auth.uid(), armado_inicio = now() where id = p.id;
  end if;
end $$;

create or replace function public.iniciar_armado(p_pedido bigint)
returns void language plpgsql security definer set search_path = public as $$
declare p pedidos;
begin
  select * into p from pedidos where id = p_pedido for update;
  perform public.chequear_armado(p.empresa_id);
  if p.estado = 'nuevo' then
    update pedidos set estado = 'armando', armado_por = auth.uid(), armado_inicio = now() where id = p_pedido;
    insert into pedido_eventos (pedido_id, empresa_id, tipo, usuario) values (p_pedido, p.empresa_id, 'armado_inicio', auth.uid());
  end if;
end $$;

-- − / + de a una unidad. Entregar menos de lo pedido marca SIN STOCK (se aplica al enviar)
create or replace function public.item_entregadas(p_item bigint, p_entregadas int)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.pedido_para_armar(p_item);
  if p_entregadas < 0 then perform public.error_app('cantidad_invalida'); end if;
  update pedido_items set
    entregadas = p_entregadas,
    marca_stock = case
      when pedidas is not null and p_entregadas < pedidas and (marca_stock is null or marca_auto) then 'sin_stock'
      when marca_auto and (pedidas is null or p_entregadas >= pedidas) then null
      else marca_stock end,
    marca_auto = case
      when pedidas is not null and p_entregadas < pedidas and (marca_stock is null or marca_auto) then true
      when marca_auto and (pedidas is null or p_entregadas >= pedidas) then false
      else marca_auto end
  where id = p_item;
  insert into pedido_eventos (pedido_id, empresa_id, tipo, detalle, usuario)
  values ((r.i).pedido_id, (r.i).empresa_id, 'cantidad', jsonb_build_object('item', p_item, 'entregadas', p_entregadas), auth.uid());
end $$;

create or replace function public.item_hecho(p_item bigint, p_hecho boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.pedido_para_armar(p_item);
  update pedido_items set hecho = p_hecho where id = p_item;
end $$;

-- Producto que el cliente se olvidó (lo suma el admin al armar)
create or replace function public.agregar_item(p_pedido bigint, p_producto bigint, p_unidades int, p_forma int default 1)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  p pedidos;
  v_pr record;
  v_id bigint;
begin
  select * into p from pedidos where id = p_pedido for update;
  perform public.chequear_armado(p.empresa_id);
  if p.estado not in ('nuevo', 'armando') then perform public.error_app('pedido_cerrado'); end if;
  select * into v_pr from public.precio_producto(p_producto, p_forma, p_unidades, public.hoy(p.empresa_id));
  if not v_pr.ok then
    select pp.precio as precio, 'lista' as origen, null::date as oferta_fecha into v_pr
      from producto_precios pp where pp.producto_id = p_producto;
  end if;
  insert into pedido_items (pedido_id, empresa_id, producto_id, orden, nombre, forma, medida, unidades_por_paso,
                            pedidas, entregadas, precio_unitario, origen_precio, oferta_fecha, agregado)
  select p_pedido, p.empresa_id, pr.id, pr.orden, pr.nombre, p_forma,
         case when p_forma = 2 then pp.presentacion_volumen else pp.presentacion_venta end,
         case when p_forma = 2 then pp.unidades_volumen else pp.step end,
         null, p_unidades, v_pr.precio, v_pr.origen, v_pr.oferta_fecha, true
    from productos pr join producto_precios pp on pp.producto_id = pr.id
   where pr.id = p_producto and pr.empresa_id = p.empresa_id
  returning id into v_id;
  if v_id is null then perform public.error_app('producto_inexistente'); end if;
  insert into pedido_eventos (pedido_id, empresa_id, tipo, detalle, usuario)
  values (p_pedido, p.empresa_id, 'agregado', jsonb_build_object('producto', p_producto, 'unidades', p_unidades), auth.uid());
  return v_id;
end $$;

create or replace function public.quitar_item(p_item bigint)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.pedido_para_armar(p_item);
  if (r.i).agregado then
    delete from pedido_items where id = p_item;
  else
    perform public.item_entregadas(p_item, 0);
  end if;
end $$;

-- CRÍTICO: confirma el stock que queda después de este pedido.
-- Por defecto la app propone: stock actual − unidades de este pedido.
create or replace function public.marcar_critico(p_item bigint, p_queda int)
returns void language plpgsql security definer set search_path = public as $$
declare
  r      record;
  v_st   stock;
  v_real int;
begin
  select * into r from public.pedido_para_armar(p_item);
  select * into v_st from stock where producto_id = (r.i).producto_id for update;
  if p_queda is not null then
    if p_queda < 0 then perform public.error_app('cantidad_invalida'); end if;
    -- El pedido se descuenta al enviarlo: el stock de hoy es lo que queda + lo de este pedido
    v_real := p_queda + (r.i).entregadas + (r.i).bonificacion;
    if v_real is distinct from v_st.cantidad then
      insert into stock_movimientos (empresa_id, producto_id, cantidad, motivo, pedido_id, usuario)
      values (v_st.empresa_id, v_st.producto_id, v_real - coalesce(v_st.cantidad, 0), 'conteo', (r.i).pedido_id, auth.uid());
      update stock set cantidad = v_real, actualizado_por = auth.uid() where producto_id = v_st.producto_id;
    end if;
  end if;
  update pedido_items set marca_stock = 'critico', marca_auto = false, conteo_real = p_queda,
         marca_previa = coalesce(marca_previa, v_st.marca)
   where id = p_item;
  update stock set marca = 'critico', actualizado_por = auth.uid()
   where producto_id = v_st.producto_id and marca = 'disponible';
end $$;

create or replace function public.marcar_sin_stock(p_item bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  r    record;
  v_st stock;
begin
  select * into r from public.pedido_para_armar(p_item);
  select * into v_st from stock where producto_id = (r.i).producto_id for update;
  update pedido_items set marca_stock = 'sin_stock', marca_auto = false,
         marca_previa = coalesce(marca_previa, v_st.marca)
   where id = p_item;
  update stock set marca = 'sin_stock', actualizado_por = auth.uid() where producto_id = v_st.producto_id;
end $$;

-- Tercer toque: se borra la marca (si se tocó por error, el producto vuelve a como estaba)
create or replace function public.quitar_marca(p_item bigint)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.pedido_para_armar(p_item);
  if (r.i).marca_previa is not null then
    update stock set marca = (r.i).marca_previa, actualizado_por = auth.uid() where producto_id = (r.i).producto_id;
  end if;
  update pedido_items set marca_stock = null, marca_auto = false, marca_previa = null where id = p_item;
end $$;

-- "Enviar al cliente": cierra el armado.
-- Congela costos, descuenta stock, aplica SIN STOCK automáticos, guarda faltantes,
-- redondea el total y devuelve los datos para armar el mensaje de WhatsApp.
create or replace function public.enviar_pedido(p_pedido bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p          pedidos;
  c          empresa_config;
  i          pedido_items;
  v_total    numeric := 0;
  v_final    numeric;
  v_falt     jsonb := '[]';
  v_items    jsonb := '[]';
begin
  select * into p from pedidos where id = p_pedido for update;
  if not found then perform public.error_app('pedido_inexistente'); end if;
  perform public.chequear_armado(p.empresa_id);
  if p.estado not in ('nuevo', 'armando') then perform public.error_app('pedido_cerrado'); end if;
  select * into c from empresa_config where empresa_id = p.empresa_id;

  perform 1 from stock where producto_id in (select producto_id from pedido_items where pedido_id = p_pedido)
   order by producto_id for update;

  for i in select * from pedido_items where pedido_id = p_pedido order by orden, id loop
    -- Costo del momento (para utilidades)
    insert into pedido_items_costos (item_id, empresa_id, costo_unitario)
    select i.id, i.empresa_id, pc.costo from producto_costos pc where pc.producto_id = i.producto_id
    on conflict (item_id) do update set costo_unitario = excluded.costo_unitario;

    -- Descuenta lo entregado (y lo bonificado)
    if i.entregadas + i.bonificacion > 0 then
      update stock set cantidad = cantidad - (i.entregadas + i.bonificacion), actualizado_por = auth.uid()
       where producto_id = i.producto_id and cantidad is not null;
      insert into stock_movimientos (empresa_id, producto_id, cantidad, motivo, pedido_id, usuario)
      values (i.empresa_id, i.producto_id, -(i.entregadas + i.bonificacion), 'pedido', p_pedido, auth.uid());
    end if;

    -- SIN STOCK automático (entregó menos de lo pedido)
    if i.marca_stock = 'sin_stock' and i.marca_auto then
      update stock set marca = 'sin_stock', actualizado_por = auth.uid()
       where producto_id = i.producto_id and marca <> 'sin_stock';
    end if;

    -- Faltante: se guarda para ofrecérselo cuando vuelva
    if i.pedidas is not null and i.entregadas < i.pedidas then
      v_falt := v_falt || jsonb_build_object('nombre', i.nombre, 'faltan', i.pedidas - i.entregadas,
                                             'entregadas', i.entregadas);
      if c.faltantes_guardar then
        insert into avisarme (empresa_id, cliente_id, producto_id, cantidad, pedido_id, precio_unitario)
        values (p.empresa_id, p.cliente_id, i.producto_id, i.pedidas - i.entregadas, p_pedido, i.precio_unitario);
      end if;
    end if;

    if i.entregadas > 0 or i.bonificacion > 0 then
      v_items := v_items || jsonb_build_object(
        'nombre', i.nombre, 'unidades', i.entregadas, 'medida', i.medida, 'por_paso', i.unidades_por_paso,
        'precio', i.precio_unitario, 'subtotal', i.entregadas * i.precio_unitario,
        'origen', i.origen_precio, 'oferta_fecha', i.oferta_fecha, 'bonificacion', i.bonificacion);
    end if;
    v_total := v_total + i.entregadas * i.precio_unitario;
  end loop;

  v_final := case when c.redondeo > 0 then round(v_total / c.redondeo) * c.redondeo else v_total end;

  update pedidos set estado = 'listo', armado_fin = now(), mensaje_enviado_en = now(),
         armado_por = coalesce(armado_por, auth.uid()), total_final = v_final
   where id = p_pedido;
  insert into pedido_eventos (pedido_id, empresa_id, tipo, detalle, usuario)
  values (p_pedido, p.empresa_id, 'enviado', jsonb_build_object('total', v_final, 'faltantes', v_falt), auth.uid());

  return jsonb_build_object(
    'numero', p.numero, 'cliente', p.cliente_nombre, 'telefono', p.cliente_telefono,
    'tipo_entrega', p.tipo_entrega,
    'items', v_items, 'faltantes', v_falt, 'total', v_total, 'total_redondeado', v_final,
    'alias', c.alias_transferencia, 'titular', c.titular,
    'local', jsonb_build_object('direccion', c.local_direccion, 'horario', c.local_horario,
                                'lat', c.local_lat, 'lng', c.local_lng));
end $$;

create or replace function public.cambiar_estado_pedido(p_pedido bigint, p_estado text, p_horario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p pedidos;
begin
  select * into p from pedidos where id = p_pedido for update;
  perform public.chequear_armado(p.empresa_id);
  if p_estado not in ('entregado', 'retirado', 'cancelado') then perform public.error_app('estado_invalido'); end if;
  if p_estado = 'cancelado' and p.estado not in ('nuevo', 'armando') then perform public.error_app('pedido_cerrado'); end if;
  if p_estado in ('entregado', 'retirado') and p.estado <> 'listo' then perform public.error_app('pedido_sin_armar'); end if;
  update pedidos set estado = p_estado, horario_entrega = coalesce(p_horario, horario_entrega) where id = p_pedido;
  insert into pedido_eventos (pedido_id, empresa_id, tipo, usuario) values (p_pedido, p.empresa_id, p_estado, auth.uid());
end $$;

create or replace function public.marcar_pago(p_pedido bigint, p_estado text, p_medio text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p pedidos;
begin
  select * into p from pedidos where id = p_pedido;
  -- El cliente puede avisar que transfirió; el pago lo confirma la distribuidora
  if p_estado = 'aviso_transferencia' and p.cliente_id = public.mi_cliente(p.empresa_id) then
    update pedidos set estado_pago = 'aviso_transferencia', medio_pago = 'transferencia' where id = p_pedido;
  else
    perform public.chequear_armado(p.empresa_id);
    update pedidos set estado_pago = p_estado, medio_pago = coalesce(p_medio, medio_pago) where id = p_pedido;
  end if;
  insert into pedido_eventos (pedido_id, empresa_id, tipo, detalle, usuario)
  values (p_pedido, p.empresa_id, 'pago', jsonb_build_object('estado', p_estado, 'medio', p_medio), auth.uid());
end $$;


-- =========================================================
-- STOCK
-- =========================================================

create or replace function public.chequear_stock(p_empresa uuid)
returns void language plpgsql stable as $$
begin
  if not public.tiene_rol(p_empresa, '{dueno,encargado,catalogo}') then perform public.error_app('sin_permiso'); end if;
end $$;

-- Fija la cantidad real (conteo o ajuste). No cambia la marca: eso solo lo hace una compra.
create or replace function public.ajustar_stock(p_producto bigint, p_cantidad int,
                                                p_motivo text default 'ajuste', p_uuid uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_st stock;
begin
  select * into v_st from stock where producto_id = p_producto for update;
  if not found then perform public.error_app('producto_inexistente'); end if;
  perform public.chequear_stock(v_st.empresa_id);
  if p_uuid is not null and exists (select 1 from stock_movimientos where uuid_origen = p_uuid) then return; end if;
  if p_cantidad < 0 or p_motivo not in ('ajuste', 'conteo', 'rotura', 'carga_inicial') then
    perform public.error_app('cantidad_invalida');
  end if;
  insert into stock_movimientos (empresa_id, producto_id, cantidad, motivo, usuario, uuid_origen)
  values (v_st.empresa_id, p_producto, p_cantidad - coalesce(v_st.cantidad, 0), p_motivo, auth.uid(), p_uuid);
  update stock set cantidad = p_cantidad, actualizado_por = auth.uid() where producto_id = p_producto;
end $$;

-- Corrección manual de la marca desde el panel (por un error de carga)
create or replace function public.cambiar_marca(p_producto bigint, p_marca text)
returns void language plpgsql security definer set search_path = public as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from stock where producto_id = p_producto;
  if not public.tiene_rol(v_empresa, '{dueno,encargado,catalogo}') then perform public.error_app('sin_permiso'); end if;
  update stock set marca = p_marca, actualizado_por = auth.uid() where producto_id = p_producto;
end $$;

-- Encender "Limitar el pedido al stock": antes revisa que todo tenga stock cargado
create or replace function public.activar_limite_stock(p_empresa uuid, p_activar boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_faltan jsonb;
begin
  if not public.puede_editar_config(p_empresa) then perform public.error_app('sin_permiso'); end if;
  if p_activar then
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'codigo', p.codigo, 'nombre', p.nombre) order by p.orden), '[]')
      into v_faltan
      from productos p join stock s on s.producto_id = p.id
     where p.empresa_id = p_empresa and p.visible and s.cantidad is null;
    if jsonb_array_length(v_faltan) > 0 then
      return jsonb_build_object('activado', false, 'sin_stock_cargado', v_faltan);
    end if;
  end if;
  perform set_config('app.activando_limite', 'on', true);
  update empresa_config set limitar_al_stock = p_activar, actualizado = now() where empresa_id = p_empresa;
  perform set_config('app.activando_limite', '', true);
  return jsonb_build_object('activado', p_activar, 'sin_stock_cargado', '[]'::jsonb);
end $$;


-- =========================================================
-- COMPRAS
-- Producto, cantidad y costo por unidad final. El total, la utilidad y el
-- mark-up se ven en vivo en la app; al registrar se congelan acá.
-- =========================================================

create or replace function public.crear_compra(p_empresa uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform public.chequear_stock(p_empresa);
  insert into compras (empresa_id, numero, fecha, cargada_por)
  values (p_empresa, public.siguiente_numero(p_empresa, 'compra'), public.hoy(p_empresa), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Botón "Comprar" de la lista de compras de un proveedor
create or replace function public.comprar_desde_lista(p_empresa uuid, p_proveedor bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  v_id := public.crear_compra(p_empresa);
  insert into compra_items (compra_id, empresa_id, producto_id, cantidad, costo_unitario)
  select v_id, p_empresa, l.producto_id, 0, coalesce(pc.costo, 0)
    from lista_compras l
    join productos p on p.id = l.producto_id
    left join producto_costos pc on pc.producto_id = l.producto_id
   where l.empresa_id = p_empresa and l.estado = 'pendiente'
     and p.proveedor_id is not distinct from p_proveedor
  on conflict do nothing;
  update lista_compras l set estado = 'en_compra', compra_id = v_id
    from productos p
   where p.id = l.producto_id and l.empresa_id = p_empresa and l.estado = 'pendiente'
     and p.proveedor_id is not distinct from p_proveedor;
  return v_id;
end $$;

create or replace function public.registrar_compra(p_compra bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  co        compras;
  v_min     numeric;
  v_total   numeric;
  v_venta   numeric;
  v_util    numeric;
  v_avisos  jsonb;
begin
  select * into co from compras where id = p_compra for update;
  if not found then perform public.error_app('compra_inexistente'); end if;
  perform public.chequear_stock(co.empresa_id);
  if co.estado <> 'borrador' then perform public.error_app('compra_registrada'); end if;

  delete from compra_items where compra_id = p_compra and cantidad = 0;
  if not exists (select 1 from compra_items where compra_id = p_compra) then perform public.error_app('compra_vacia'); end if;

  select markup_minimo into v_min from empresa_config where empresa_id = co.empresa_id;

  -- Precio de referencia: PrecioPorVolumen, o el precio por unidad si no tiene
  update compra_items ci set precio_referencia = coalesce(pp.precio_volumen, pp.precio)
    from producto_precios pp where pp.producto_id = ci.producto_id and ci.compra_id = p_compra;

  perform 1 from stock where producto_id in (select producto_id from compra_items where compra_id = p_compra)
   order by producto_id for update;

  -- Suma stock y vuelve a "disponible" (el trigger saca de la lista, novedad reingreso y avisa)
  update stock s set cantidad = coalesce(s.cantidad, 0) + ci.cantidad, marca = 'disponible', actualizado_por = auth.uid()
    from compra_items ci where ci.compra_id = p_compra and ci.producto_id = s.producto_id;
  insert into stock_movimientos (empresa_id, producto_id, cantidad, motivo, compra_id, usuario)
  select co.empresa_id, producto_id, cantidad, 'compra', p_compra, auth.uid() from compra_items where compra_id = p_compra;

  -- El costo pasa a ser el de esta compra
  insert into producto_costos (producto_id, empresa_id, costo, actualizado)
  select producto_id, co.empresa_id, costo_unitario, now() from compra_items where compra_id = p_compra
  on conflict (producto_id) do update set costo = excluded.costo, actualizado = now();

  select sum(cantidad * costo_unitario), sum(cantidad * coalesce(precio_referencia, 0))
    into v_total, v_venta from compra_items where compra_id = p_compra;
  v_util := v_venta - v_total;

  select coalesce(jsonb_agg(jsonb_build_object('producto', p.nombre,
            'markup', round(ci.precio_referencia / nullif(ci.costo_unitario, 0) - 1, 4))), '[]')
    into v_avisos
    from compra_items ci join productos p on p.id = ci.producto_id
   where ci.compra_id = p_compra and ci.costo_unitario > 0
     and ci.precio_referencia / ci.costo_unitario - 1 < coalesce(p.markup_minimo, v_min);

  update compras set estado = 'registrada', registrada_en = now(), total = v_total,
         utilidad_esperada = v_util, markup = case when v_total > 0 then round(v_venta / v_total - 1, 4) end
   where id = p_compra;

  return jsonb_build_object('total', v_total, 'utilidad_esperada', v_util,
                            'markup', case when v_total > 0 then round(v_venta / v_total - 1, 4) end,
                            'debajo_del_minimo', v_avisos,
                            'clientes_esperando', (select count(*) from avisarme a join compra_items ci
                                                    on ci.producto_id = a.producto_id
                                                   where ci.compra_id = p_compra and a.estado = 'avisado'
                                                     and a.avisado_en >= now() - interval '1 minute'));
end $$;


-- =========================================================
-- CLIENTES
-- =========================================================

-- Se llama después de crear el usuario (Edge Function "registro-cliente").
-- Si el celular ya tenía una ficha "sin cuenta" (pedidos por WhatsApp), la usa.
create or replace function public.registrar_cliente(
  p_empresa uuid, p_nombre text, p_telefono text, p_perfil text,
  p_nombre_negocio text default null, p_entrega text default null, p_email text default null,
  p_acepta_privacidad boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c     empresa_config;
  cli   clientes;
  v_est text;
begin
  if auth.uid() is null then perform public.error_app('sin_sesion'); end if;
  if not p_acepta_privacidad then perform public.error_app('aceptar_privacidad'); end if;
  if p_telefono !~ '^\+[0-9]{10,15}$' then perform public.error_app('telefono_invalido'); end if;
  select * into c from empresa_config where empresa_id = p_empresa;
  v_est := case when c.modo_catalogo = 'solo_listado' then 'pendiente' else 'aprobado' end;

  select * into cli from clientes where empresa_id = p_empresa and telefono = p_telefono for update;
  if found then
    if cli.user_id is not null and cli.user_id <> auth.uid() then perform public.error_app('telefono_registrado'); end if;
    update clientes set user_id = auth.uid(), nombre = p_nombre, perfil = p_perfil,
           nombre_negocio = p_nombre_negocio, entrega_preferida = p_entrega, email = p_email,
           estado = case when estado in ('sin_cuenta') then v_est else estado end,
           acepto_privacidad_en = now()
     where id = cli.id;
  else
    insert into clientes (empresa_id, user_id, nombre, telefono, perfil, nombre_negocio,
                          entrega_preferida, email, estado, acepto_privacidad_en)
    values (p_empresa, auth.uid(), p_nombre, p_telefono, p_perfil, p_nombre_negocio,
            p_entrega, p_email, v_est, now())
    returning * into cli;
  end if;
  select * into cli from clientes where empresa_id = p_empresa and telefono = p_telefono;
  return jsonb_build_object('cliente_id', cli.id, 'estado', cli.estado);
end $$;

create or replace function public.aprobar_cliente(p_cliente bigint, p_estado text)
returns void language plpgsql security definer set search_path = public as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from clientes where id = p_cliente;
  if not public.tiene_rol(v_empresa, '{dueno,encargado}') then perform public.error_app('sin_permiso'); end if;
  if p_estado not in ('aprobado', 'suspendido', 'rechazado', 'pendiente') then perform public.error_app('estado_invalido'); end if;
  update clientes set estado = p_estado,
         telefono_verificado = telefono_verificado or p_estado = 'aprobado'
   where id = p_cliente;
end $$;

-- Al confirmar su primer pedido por WhatsApp
create or replace function public.verificar_telefono(p_cliente bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from clientes where id = p_cliente;
  perform public.chequear_armado(v_empresa);
  update clientes set telefono_verificado = true where id = p_cliente;
end $$;

-- "Olvidé mi clave": el panel genera un código de un solo uso (24 h, 5 intentos)
create or replace function public.generar_codigo_reset(p_cliente bigint)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_empresa uuid;
  v_codigo  text;
begin
  select empresa_id into v_empresa from clientes where id = p_cliente;
  if not public.tiene_rol(v_empresa, '{dueno,encargado,armado}') then perform public.error_app('sin_permiso'); end if;
  -- Sin letras ni números que se confunden (O/0, I/1)
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
    into v_codigo from generate_series(1, 6);
  update codigos_reset set usado_en = now() where cliente_id = p_cliente and usado_en is null;
  insert into codigos_reset (empresa_id, cliente_id, codigo_hash, vence, creado_por)
  values (v_empresa, p_cliente, crypt(v_codigo, gen_salt('bf')), now() + interval '24 hours', auth.uid());
  return v_codigo;
end $$;

-- Lo usa SOLO la Edge Function "reset-clave" (con la clave de servicio)
create or replace function public.validar_codigo_reset(p_empresa uuid, p_telefono text, p_codigo text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  cr  codigos_reset;
  cli clientes;
begin
  select * into cli from clientes where empresa_id = p_empresa and telefono = p_telefono;
  if not found or cli.user_id is null then perform public.error_app('codigo_invalido'); end if;
  select * into cr from codigos_reset
   where cliente_id = cli.id and usado_en is null and vence > now()
   order by creado desc limit 1 for update;
  if not found or cr.intentos >= 5 then perform public.error_app('codigo_invalido'); end if;
  if cr.codigo_hash <> crypt(upper(trim(p_codigo)), cr.codigo_hash) then
    update codigos_reset set intentos = intentos + 1 where id = cr.id;
    return null;
  end if;
  update codigos_reset set usado_en = now() where id = cr.id;
  return cli.user_id;
end $$;


-- =========================================================
-- FALTANTES Y "AVISAME"
-- =========================================================

-- 🔔 "Avisame cuando vuelva" tocado por el cliente
create or replace function public.avisame(p_producto bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_empresa uuid;
  v_cli     bigint;
begin
  select empresa_id into v_empresa from productos where id = p_producto;
  v_cli := public.mi_cliente(v_empresa);
  if v_cli is null then perform public.error_app('registrate_primero'); end if;
  insert into avisarme (empresa_id, cliente_id, producto_id) values (v_empresa, v_cli, p_producto)
  on conflict do nothing;
end $$;

create or replace function public.descartar_faltante(p_avisarme bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update avisarme a set estado = 'descartado'
   where a.id = p_avisarme and a.cliente_id = public.mi_cliente(a.empresa_id)
     and a.estado in ('esperando', 'avisado');
end $$;

-- Panel: "Clientes con faltantes" (para avisarles por WhatsApp)
create or replace function public.clientes_con_faltantes(p_empresa uuid, p_producto bigint default null)
returns table (avisarme_id bigint, cliente text, telefono text, producto text, cantidad int,
               fecha_pedido timestamptz, estado text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_miembro(p_empresa) then perform public.error_app('sin_permiso'); end if;
  return query
  select a.id, cl.nombre, cl.telefono, p.nombre, a.cantidad, pe.creado,
         case when a.estado = 'avisado' and a.vence <= now() then 'vencido' else a.estado end
    from avisarme a
    join clientes cl on cl.id = a.cliente_id
    join productos p on p.id = a.producto_id
    left join pedidos pe on pe.id = a.pedido_id
   where a.empresa_id = p_empresa and a.pedido_id is not null
     and (p_producto is null or a.producto_id = p_producto)
     and a.creado > now() - interval '60 days'
   order by a.creado desc;
end $$;


-- =========================================================
-- NOVEDADES DEL CLIENTE
-- Orden: 1) lo que esperaba (Avisame / faltante) y ya volvió
--        2) novedades de sus favoritos · 3) las demás ("Ver más novedades…")
-- =========================================================
create or replace function public.mis_novedades(p_empresa uuid)
returns table (grupo text, tipo text, producto_id bigint, nombre text, imagen text,
               valor_anterior numeric, valor_nuevo numeric, creado timestamptz,
               avisarme_id bigint, cantidad int, precio_faltante numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  cli      clientes;
  v_dias   int;
  v_desde  timestamptz;
  v_precio text;
begin
  select * into cli from clientes where empresa_id = p_empresa and user_id = auth.uid();
  if not found then return; end if;
  select novedades_dias, faltantes_precio into v_dias, v_precio from empresa_config where empresa_id = p_empresa;
  select greatest(now() - make_interval(days => v_dias), coalesce(nv.borradas_hasta, '-infinity'))
    into v_desde from (select 1) x left join novedades_vistas nv on nv.cliente_id = cli.id;

  return query
  -- 1) Lo que esperaba y volvió
  select 'avisarme'::text, 'reingreso'::text, p.id, p.nombre, p.imagen, null::numeric, null::numeric,
         a.avisado_en, a.id, a.cantidad,
         case when v_precio = 'original' then a.precio_unitario end
    from avisarme a join productos p on p.id = a.producto_id
   where a.cliente_id = cli.id and a.estado = 'avisado' and (a.vence is null or a.vence > now())
  union all
  -- 2 y 3) Novedades según el perfil; la más reciente por producto y tipo
  select case when f.producto_id is not null then 'favorito' else 'otro' end,
         ev.tipo, p.id, p.nombre, p.imagen, ev.valor_anterior, ev.valor_nuevo, ev.creado,
         null::bigint, null::int, null::numeric
    from (select distinct on (pe.producto_id, pe.tipo) pe.*
            from producto_eventos pe
           where pe.empresa_id = p_empresa and pe.creado > v_desde
           order by pe.producto_id, pe.tipo, pe.creado desc) ev
    join productos p on p.id = ev.producto_id and p.visible
    join novedades_reglas r on r.empresa_id = p_empresa and r.tipo = ev.tipo
    left join favoritos f on f.cliente_id = cli.id and f.producto_id = ev.producto_id
   where (cli.perfil = 'hogar' and r.ve_hogar) or (cli.perfil = 'negocio' and r.ve_negocio)
  order by 1, 8 desc;
end $$;

-- "¿Querés borrar todas las novedades?" → sí
create or replace function public.borrar_novedades(p_empresa uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_cli bigint := public.mi_cliente(p_empresa);
begin
  if v_cli is null then return; end if;
  insert into novedades_vistas (cliente_id, borradas_hasta, ultima_vista) values (v_cli, now(), now())
  on conflict (cliente_id) do update set borradas_hasta = now(), ultima_vista = now();
end $$;

create or replace function public.novedades_vistas_ahora(p_empresa uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_cli bigint := public.mi_cliente(p_empresa);
begin
  if v_cli is null then return; end if;
  insert into novedades_vistas (cliente_id, ultima_vista) values (v_cli, now())
  on conflict (cliente_id) do update set ultima_vista = now();
end $$;


-- =========================================================
-- ABONO A CES.ART Y COBROS
-- =========================================================

-- Panel del dueño de la distribuidora: estado del abono y código de pago
create or replace function public.mi_abono(p_empresa uuid, p_meses int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e        empresas;
  v_estado text;
  v_desde  date;
  v_hasta  date;
  v_cod    codigos_pago_abono;
  v_codigo text;
begin
  if not public.tiene_rol(p_empresa, '{dueno}') then perform public.error_app('sin_permiso'); end if;
  if p_meses < 1 or p_meses > 12 then perform public.error_app('cantidad_invalida'); end if;
  select * into e from empresas where id = p_empresa;
  v_estado := public.estado_abono(p_empresa);
  v_desde := (coalesce(e.abono_pagado_hasta, date_trunc('month', e.creado)::date) + interval '1 month')::date;
  v_hasta := (v_desde + make_interval(months => p_meses - 1))::date;

  select * into v_cod from codigos_pago_abono where empresa_id = p_empresa and usado_en is null;
  if not found or v_cod.mes_desde <> v_desde or v_cod.mes_hasta <> v_hasta or v_cod.intentos >= 5 then
    delete from codigos_pago_abono where empresa_id = p_empresa and usado_en is null;
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      into v_codigo from generate_series(1, 4);
    insert into codigos_pago_abono (empresa_id, mes_desde, mes_hasta, monto, codigo)
    values (p_empresa, v_desde, v_hasta, e.abono_monto * p_meses, v_codigo)
    returning * into v_cod;
  end if;

  return jsonb_build_object('estado', v_estado, 'pagado_hasta', e.abono_pagado_hasta,
                            'mes_desde', v_cod.mes_desde, 'mes_hasta', v_cod.mes_hasta,
                            'monto', v_cod.monto, 'codigo', v_cod.codigo);
end $$;

-- Lo que ve el cobrador antes de cobrar (sin el código)
create or replace function public.cobro_preview(p_empresa uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_cod codigos_pago_abono;
begin
  if not (public.es_cobrador_de(p_empresa) or public.es_dueno_plataforma()) then perform public.error_app('sin_permiso'); end if;
  select * into v_cod from codigos_pago_abono where empresa_id = p_empresa and usado_en is null;
  return jsonb_build_object('empresa', (select nombre from empresas where id = p_empresa),
                            'estado', public.estado_abono(p_empresa),
                            'mes_desde', v_cod.mes_desde, 'mes_hasta', v_cod.mes_hasta, 'monto', v_cod.monto,
                            'hay_codigo', v_cod.id is not null);
end $$;

-- El cliente escribe el código en el celular del cobrador
create or replace function public.registrar_cobro_efectivo(p_empresa uuid, p_codigo text,
                                                           p_lat double precision default null,
                                                           p_lng double precision default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cod  codigos_pago_abono;
  v_pago pagos_abono;
begin
  if not (public.es_cobrador_de(p_empresa) or public.es_dueno_plataforma()) then perform public.error_app('sin_permiso'); end if;
  select * into v_cod from codigos_pago_abono where empresa_id = p_empresa and usado_en is null for update;
  if not found then perform public.error_app('sin_codigo'); end if;
  if v_cod.intentos >= 5 then perform public.error_app('codigo_bloqueado'); end if;
  if upper(trim(p_codigo)) <> v_cod.codigo then
    update codigos_pago_abono set intentos = intentos + 1 where id = v_cod.id;
    return jsonb_build_object('ok', false, 'intentos_restantes', 4 - v_cod.intentos);
  end if;

  update codigos_pago_abono set usado_en = now() where id = v_cod.id;
  insert into pagos_abono (empresa_id, mes_desde, mes_hasta, monto, medio, cobrador_id,
                           confirmado_por_cliente_en, lat, lng)
  values (p_empresa, v_cod.mes_desde, v_cod.mes_hasta, v_cod.monto, 'efectivo', auth.uid(), now(), p_lat, p_lng)
  returning * into v_pago;

  return jsonb_build_object('ok', true, 'recibo', v_pago.numero_recibo, 'monto', v_pago.monto,
                            'mes_desde', v_pago.mes_desde, 'mes_hasta', v_pago.mes_hasta);
end $$;

-- El cobrador rinde lo cobrado en efectivo a Ces.Art
create or replace function public.crear_rendicion()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not exists (select 1 from plataforma_miembros where user_id = auth.uid() and activo) then
    perform public.error_app('sin_permiso');
  end if;
  if not exists (select 1 from pagos_abono where cobrador_id = auth.uid() and medio = 'efectivo' and rendicion_id is null) then
    perform public.error_app('nada_para_rendir');
  end if;
  insert into rendiciones (cobrador_id) values (auth.uid()) returning id into v_id;
  update pagos_abono set rendicion_id = v_id
   where cobrador_id = auth.uid() and medio = 'efectivo' and rendicion_id is null;
  update rendiciones set monto_total = (select sum(monto) from pagos_abono where rendicion_id = v_id),
                         cantidad_pagos = (select count(*) from pagos_abono where rendicion_id = v_id)
   where id = v_id;
  return (select jsonb_build_object('rendicion', id, 'monto', monto_total, 'pagos', cantidad_pagos)
            from rendiciones where id = v_id);
end $$;

create or replace function public.confirmar_rendicion(p_rendicion bigint, p_recibido numeric, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r rendiciones;
begin
  if not public.es_dueno_plataforma() then perform public.error_app('sin_permiso'); end if;
  select * into r from rendiciones where id = p_rendicion for update;
  update rendiciones set
    estado = case when p_recibido = r.monto_total then 'confirmada' else 'con_diferencia' end,
    diferencia = p_recibido - r.monto_total, nota = p_nota,
    confirmada_por = auth.uid(), confirmada_en = now()
   where id = p_rendicion;
end $$;


-- =========================================================
-- INFORMES (solo dueño, o encargado si el dueño lo permite)
-- =========================================================
create or replace function public.informe_ventas(p_empresa uuid, p_desde date, p_hasta date)
returns table (dia date, pedidos bigint, venta numeric, costo numeric, utilidad numeric, markup numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.puede_ver_costos(p_empresa) then perform public.error_app('sin_permiso'); end if;
  return query
  select (pe.armado_fin at time zone c.zona_horaria)::date,
         count(distinct pe.id),
         sum(i.entregadas * i.precio_unitario),
         sum((i.entregadas + i.bonificacion) * coalesce(ic.costo_unitario, 0)),
         sum(i.entregadas * i.precio_unitario - (i.entregadas + i.bonificacion) * coalesce(ic.costo_unitario, 0)),
         round(sum(i.entregadas * i.precio_unitario)
               / nullif(sum((i.entregadas + i.bonificacion) * ic.costo_unitario), 0) - 1, 4)
    from pedidos pe
    join empresa_config c on c.empresa_id = pe.empresa_id
    join pedido_items i on i.pedido_id = pe.id
    left join pedido_items_costos ic on ic.item_id = i.id
   where pe.empresa_id = p_empresa and pe.estado in ('listo', 'entregado', 'retirado')
     and (pe.armado_fin at time zone c.zona_horaria)::date between p_desde and p_hasta
   group by 1 order by 1;
end $$;

create or replace function public.informe_productos(p_empresa uuid, p_desde date, p_hasta date)
returns table (producto_id bigint, producto text, categoria text, unidades bigint,
               venta numeric, utilidad numeric, markup numeric, debajo_del_minimo boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.puede_ver_costos(p_empresa) then perform public.error_app('sin_permiso'); end if;
  return query
  select p.id, p.nombre, k.nombre,
         sum(i.entregadas)::bigint,
         sum(i.entregadas * i.precio_unitario),
         sum(i.entregadas * i.precio_unitario - (i.entregadas + i.bonificacion) * coalesce(ic.costo_unitario, 0)),
         round(sum(i.entregadas * i.precio_unitario)
               / nullif(sum((i.entregadas + i.bonificacion) * ic.costo_unitario), 0) - 1, 4),
         coalesce(sum(i.entregadas * i.precio_unitario)
               / nullif(sum((i.entregadas + i.bonificacion) * ic.costo_unitario), 0) - 1
               < coalesce(p.markup_minimo, c.markup_minimo), false)
    from pedidos pe
    join empresa_config c on c.empresa_id = pe.empresa_id
    join pedido_items i on i.pedido_id = pe.id
    join productos p on p.id = i.producto_id
    left join categorias k on k.id = p.categoria_id
    left join pedido_items_costos ic on ic.item_id = i.id
   where pe.empresa_id = p_empresa and pe.estado in ('listo', 'entregado', 'retirado')
     and (pe.armado_fin at time zone c.zona_horaria)::date between p_desde and p_hasta
   group by p.id, p.nombre, k.nombre, p.markup_minimo, c.markup_minimo
   order by 6 desc;
end $$;


-- =========================================================
-- IMPORTACIÓN DEL EXCEL (products-data.js)
-- p_filas: el array de products-data.js tal cual (FechaOferta, Id, supplier, brand,
--          category, name, keywords, inStock, price, PrecioOferta, step,
--          PresentacionVenta, PrecioPorVolumen, PresentacionPorVolumen,
--          UnidadesPorVolumen, MinimoPorVolumen, image, ribbon, destacado, TipoMuestra)
-- p_carga_inicial: también carga stock (inStock false → SIN STOCK) y arma los
--                  grupos con la regla de keywords; no genera novedades.
-- Después de la carga inicial NO pisa el stock ni los grupos (manda el panel).
-- =========================================================
-- Minúsculas y sin tildes (como normalize("NFD") de la app)
create or replace function public.sin_tildes(p text)
returns text language sql immutable as $$
  select translate(lower(coalesce(p, '')), 'áéíóúüñàèìòùâêîôûäëïö', 'aeiouunaeiouaeiouaeio')
$$;

create or replace function public.importar_productos(p_empresa uuid, p_filas jsonb, p_carga_inicial boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f         jsonb;
  v_pos     int := 0;
  v_cat     bigint;
  v_prov    bigint;
  v_prod    bigint;
  v_tipo    text;
  v_kw      text;
  v_etiq    text[];
  v_nuevos  int := 0;
  v_actual  int := 0;
  v_grupos  int := 0;
  v_poster  record;
begin
  if not public.tiene_rol(p_empresa, '{dueno,encargado,catalogo}') then perform public.error_app('sin_permiso'); end if;
  if p_carga_inicial then perform set_config('app.sin_novedades', 'on', true); end if;

  for f in select * from jsonb_array_elements(p_filas) loop
    v_pos := v_pos + 10;
    v_tipo := lower(coalesce(nullif(trim(f->>'TipoMuestra'), ''), 'producto'));

    -- Categoría (en el orden en que aparece en el Excel)
    insert into categorias (empresa_id, nombre, orden)
    values (p_empresa, trim(f->>'category'), v_pos)
    on conflict (empresa_id, nombre) do nothing;
    select id into v_cat from categorias where empresa_id = p_empresa and nombre = trim(f->>'category');

    -- Keywords: las palabras con # son etiquetas
    select coalesce(string_agg(w, ' ') filter (where w !~ '^#'), ''),
           coalesce(array_agg(lower(substr(w, 2))) filter (where w ~ '^#.'), '{}')
      into v_kw, v_etiq
      from regexp_split_to_table(coalesce(f->>'keywords', ''), '\s+') w where w <> '';

    if v_tipo in ('poster', 'afiche') then
      insert into lineas (empresa_id, codigo, nombre, imagen, destacado, orden, categoria_id)
      values (p_empresa, f->>'Id', f->>'name', f->>'image', coalesce((f->>'destacado')::boolean, false), v_pos, v_cat)
      on conflict (empresa_id, codigo) do update
        set nombre = excluded.nombre, imagen = excluded.imagen, destacado = excluded.destacado,
            categoria_id = excluded.categoria_id,
            orden = case when p_carga_inicial then excluded.orden else lineas.orden end;
      continue;
    end if;
    if v_tipo = 'separador' then continue; end if;   -- los separadores van en la categoría

    insert into proveedores (empresa_id, nombre) values (p_empresa, coalesce(nullif(trim(f->>'supplier'), ''), 'Sin proveedor'))
    on conflict (empresa_id, nombre) do nothing;
    select id into v_prov from proveedores where empresa_id = p_empresa
       and nombre = coalesce(nullif(trim(f->>'supplier'), ''), 'Sin proveedor');

    select id into v_prod from productos where empresa_id = p_empresa and codigo = f->>'Id';
    if v_prod is null then
      insert into productos (empresa_id, codigo, nombre, marca, categoria_id, proveedor_id, keywords, etiquetas,
                             cinta, destacado, orden, imagen)
      values (p_empresa, f->>'Id', f->>'name', f->>'brand', v_cat, v_prov, v_kw, v_etiq,
              nullif(f->>'ribbon', ''), coalesce((f->>'destacado')::boolean, false), v_pos, f->>'image')
      returning id into v_prod;
      v_nuevos := v_nuevos + 1;
    else
      update productos set nombre = f->>'name', marca = f->>'brand', categoria_id = v_cat, proveedor_id = v_prov,
             keywords = v_kw, etiquetas = v_etiq, cinta = nullif(f->>'ribbon', ''),
             destacado = coalesce((f->>'destacado')::boolean, false), imagen = f->>'image',
             orden = case when p_carga_inicial then v_pos else orden end
       where id = v_prod;
      v_actual := v_actual + 1;
    end if;

    insert into producto_precios (producto_id, empresa_id, precio, step, presentacion_venta, precio_volumen,
                                  presentacion_volumen, unidades_volumen, minimo_volumen)
    values (v_prod, p_empresa, coalesce((f->>'price')::numeric, 0), coalesce(nullif(f->>'step', '')::int, 1),
            coalesce(nullif(f->>'PresentacionVenta', ''), 'unidad'), (f->>'PrecioPorVolumen')::numeric,
            nullif(f->>'PresentacionPorVolumen', ''), (f->>'UnidadesPorVolumen')::int, (f->>'MinimoPorVolumen')::int)
    on conflict (producto_id) do update set
      precio = excluded.precio, step = excluded.step, presentacion_venta = excluded.presentacion_venta,
      precio_volumen = excluded.precio_volumen, presentacion_volumen = excluded.presentacion_volumen,
      unidades_volumen = excluded.unidades_volumen, minimo_volumen = excluded.minimo_volumen
    where (producto_precios.precio, producto_precios.step, producto_precios.precio_volumen,
           producto_precios.unidades_volumen, producto_precios.minimo_volumen)
          is distinct from (excluded.precio, excluded.step, excluded.precio_volumen,
                            excluded.unidades_volumen, excluded.minimo_volumen);

    -- Oferta del Excel (PrecioOferta + FechaOferta)
    if nullif(f->>'PrecioOferta', '') is not null then
      if nullif(f->>'FechaOferta', '') is null then
        delete from ofertas where producto_id = v_prod and fecha is null;
        insert into ofertas (empresa_id, producto_id, precio_oferta, fecha)
        values (p_empresa, v_prod, (f->>'PrecioOferta')::numeric, null);
      else
        delete from ofertas where producto_id = v_prod and fecha = (f->>'FechaOferta')::date;
        insert into ofertas (empresa_id, producto_id, precio_oferta, fecha)
        values (p_empresa, v_prod, (f->>'PrecioOferta')::numeric, (f->>'FechaOferta')::date);
      end if;
    else
      update ofertas set activa = false where producto_id = v_prod and fecha is null and activa;
    end if;

    if p_carga_inicial then
      update stock set marca = case when coalesce((f->>'inStock')::boolean, true) then 'disponible' else 'sin_stock' end
       where producto_id = v_prod;
    end if;
  end loop;

  -- Grupos: en la carga inicial, la regla de keywords de hoy (todas las palabras del poster)
  if p_carga_inicial then
    for v_poster in select l.id, l.codigo from lineas l where l.empresa_id = p_empresa order by l.orden loop
      -- Un producto es variedad del poster si sus keywords tienen todas las palabras
      -- de las keywords del poster. Si coincide con dos, queda en el primero.
      update productos p set linea_id = v_poster.id
       where p.empresa_id = p_empresa and p.linea_id is null
         and not exists (
           select 1 from jsonb_array_elements(p_filas) x,
                         regexp_split_to_table(public.sin_tildes(coalesce(x->>'keywords', '')), '[\s,;]+') w
            where x->>'Id' = v_poster.codigo and w <> '' and w !~ '^#'
              and not (w = any (regexp_split_to_array(public.sin_tildes(p.keywords), '[\s,;]+'))))
         and exists (select 1 from jsonb_array_elements(p_filas) x
                      where x->>'Id' = v_poster.codigo and trim(coalesce(x->>'keywords', '')) <> '');
    end loop;
    select count(*) into v_grupos from productos where empresa_id = p_empresa and linea_id is not null;
  end if;

  return jsonb_build_object('nuevos', v_nuevos, 'actualizados', v_actual,
                            'productos_en_grupos', v_grupos,
                            'grupos', (select count(*) from lineas where empresa_id = p_empresa),
                            'categorias', (select count(*) from categorias where empresa_id = p_empresa));
end $$;
