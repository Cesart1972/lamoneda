-- =========================================================
-- 2. FUNCIONES DE BASE, PERMISOS Y AUTOMATISMOS
-- ---------------------------------------------------------
-- - Quién es quién (miembro, cliente, Ces.Art) y qué puede ver
-- - Estado del abono
-- - Triggers: altas por defecto, novedades, lista de compras,
--   avisos de faltantes
-- =========================================================


-- ---------------------------------------------------------
-- QUIÉN ES QUIÉN
-- (security definer: se usan dentro de las reglas de seguridad
--  sin que las reglas se llamen a sí mismas)
-- ---------------------------------------------------------

create or replace function public.es_dueno_plataforma()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from plataforma_miembros
                 where user_id = auth.uid() and activo and rol = 'dueno_plataforma')
$$;

create or replace function public.es_cobrador_de(p_empresa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from plataforma_miembros pm
                 join cobrador_empresas ce on ce.cobrador_id = pm.user_id
                 where pm.user_id = auth.uid() and pm.activo and ce.empresa_id = p_empresa)
$$;

create or replace function public.mis_roles(p_empresa uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce((select roles from miembros
                   where empresa_id = p_empresa and user_id = auth.uid() and activo), '{}')
$$;

create or replace function public.tiene_rol(p_empresa uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.mis_roles(p_empresa) && p_roles
$$;

create or replace function public.es_miembro(p_empresa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select cardinality(public.mis_roles(p_empresa)) > 0
$$;

-- Ficha de cliente del usuario conectado en esa distribuidora
create or replace function public.mi_cliente(p_empresa uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select id from clientes where empresa_id = p_empresa and user_id = auth.uid()
$$;

create or replace function public.puede_ver_costos(p_empresa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tiene_rol(p_empresa, '{dueno}')
      or (public.tiene_rol(p_empresa, '{encargado}')
          and coalesce((select encargado_ve_costos from empresa_config where empresa_id = p_empresa), false))
$$;

create or replace function public.puede_editar_config(p_empresa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tiene_rol(p_empresa, '{dueno}')
      or (public.tiene_rol(p_empresa, '{encargado}')
          and coalesce((select encargado_edita_config from empresa_config where empresa_id = p_empresa), false))
$$;

-- "Hoy" según la zona horaria de la distribuidora (nunca la del celular)
create or replace function public.hoy(p_empresa uuid)
returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select zona_horaria from empresa_config where empresa_id = p_empresa),
                                      'America/Argentina/Buenos_Aires'))::date
$$;


-- ---------------------------------------------------------
-- ESTADO DEL ABONO
-- Ejemplo con abono_pagado_hasta = noviembre:
--   noviembre y 1-9 dic → al_dia · 10-19 dic → recordatorio
--   20-31 dic → alerta · 1-15 ene → suspendida · desde 16 ene → catalogo_oculto
-- ---------------------------------------------------------
create or replace function public.estado_abono(p_empresa uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  e        empresas;
  v_hoy    date := public.hoy(p_empresa);
  v_mes    date := date_trunc('month', v_hoy)::date;
  v_pagado date;
  v_dia    int  := extract(day from v_hoy);
begin
  select * into e from empresas where id = p_empresa;
  if not found then return 'catalogo_oculto'; end if;

  if e.estado_manual = 'baja' then return 'catalogo_oculto'; end if;
  if e.estado_manual = 'suspendida' then return 'suspendida'; end if;
  if e.estado_manual = 'cortesia' and e.cortesia_hasta >= v_hoy then return 'al_dia'; end if;

  -- Si nunca pagó, cuenta el mes en que se dio de alta
  v_pagado := coalesce(e.abono_pagado_hasta, date_trunc('month', e.creado)::date);

  if v_mes <= v_pagado then return 'al_dia'; end if;
  if v_mes = (v_pagado + interval '1 month')::date then
    if v_dia < 10 then return 'al_dia'; end if;
    if v_dia < 20 then return 'recordatorio'; end if;
    return 'alerta';
  end if;
  if v_mes = (v_pagado + interval '2 month')::date and v_dia <= 15 then return 'suspendida'; end if;
  return 'catalogo_oculto';
end $$;

-- ¿Se pueden ver los precios? (modo del catálogo, miembro o cliente aprobado)
create or replace function public.puede_ver_precios(p_empresa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.estado_abono(p_empresa) <> 'catalogo_oculto'
     and (   (select modo_catalogo from empresa_config where empresa_id = p_empresa) = 'publico_con_precios'
          or public.es_miembro(p_empresa)
          or exists (select 1 from clientes where empresa_id = p_empresa
                     and user_id = auth.uid() and estado = 'aprobado'))
$$;

create or replace function public.catalogo_visible(p_empresa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.estado_abono(p_empresa) <> 'catalogo_oculto' or public.es_miembro(p_empresa)
$$;


-- ---------------------------------------------------------
-- NÚMEROS CORRELATIVOS (#1, #2… por distribuidora)
-- ---------------------------------------------------------
create or replace function public.siguiente_numero(p_empresa uuid, p_nombre text)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into contadores (empresa_id, nombre, valor) values (p_empresa, p_nombre, 1)
  on conflict (empresa_id, nombre) do update set valor = contadores.valor + 1
  returning valor into v;
  return v;
end $$;

-- Error con un código corto que la app traduce a un mensaje amable
create or replace function public.error_app(p_codigo text, p_detalle jsonb default null)
returns void language plpgsql as $$
begin
  raise exception '%', p_codigo using errcode = 'P0001', detail = coalesce(p_detalle::text, '');
end $$;


-- ---------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------

-- Distribuidora nueva: configuración y reglas de novedades por defecto
create or replace function public.tg_empresa_nueva()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into empresa_config (empresa_id) values (new.id) on conflict do nothing;
  insert into novedades_reglas (empresa_id, tipo, ve_hogar, ve_negocio) values
    (new.id, 'nuevo',       true,  true),
    (new.id, 'precio_baja', true,  true),
    (new.id, 'precio_sube', false, true),
    (new.id, 'reingreso',   true,  true),
    (new.id, 'sin_stock',   false, true)
  on conflict do nothing;
  return new;
end $$;
create trigger empresa_nueva after insert on public.empresas
  for each row execute function public.tg_empresa_nueva();

-- ¿Estamos en la carga inicial? (no genera novedades)
create or replace function public.sin_novedades()
returns boolean language sql stable as $$
  select coalesce(current_setting('app.sin_novedades', true), '') = 'on'
$$;

-- Producto nuevo: su fila de stock (sin cargar) y la novedad "nuevo"
create or replace function public.tg_producto_nuevo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into stock (producto_id, empresa_id) values (new.id, new.empresa_id) on conflict do nothing;
  if not public.sin_novedades() and new.visible then
    insert into producto_eventos (empresa_id, producto_id, tipo, usuario)
    values (new.empresa_id, new.id, 'nuevo', auth.uid());
  end if;
  return new;
end $$;
create trigger producto_nuevo after insert on public.productos
  for each row execute function public.tg_producto_nuevo();

create or replace function public.tg_producto_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado := now();
  return new;
end $$;
create trigger producto_actualizado before update on public.productos
  for each row execute function public.tg_producto_actualizado();

-- Cambio de precio: novedad "sube" o "baja" (precio por unidad o por volumen)
create or replace function public.tg_precio_cambio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.actualizado := now();
  if public.sin_novedades() then return new; end if;
  if new.precio is distinct from old.precio then
    insert into producto_eventos (empresa_id, producto_id, tipo, valor_anterior, valor_nuevo, usuario)
    values (new.empresa_id, new.producto_id,
            case when new.precio > old.precio then 'precio_sube' else 'precio_baja' end,
            old.precio, new.precio, auth.uid());
  elsif new.precio_volumen is distinct from old.precio_volumen
        and new.precio_volumen is not null and old.precio_volumen is not null then
    insert into producto_eventos (empresa_id, producto_id, tipo, valor_anterior, valor_nuevo, usuario)
    values (new.empresa_id, new.producto_id,
            case when new.precio_volumen > old.precio_volumen then 'precio_sube' else 'precio_baja' end,
            old.precio_volumen, new.precio_volumen, auth.uid());
  end if;
  return new;
end $$;
create trigger precio_cambio before update on public.producto_precios
  for each row execute function public.tg_precio_cambio();

-- Cambio de marca de stock:
--   crítico / sin stock → entra a la lista de compras (+ novedad "sin stock")
--   vuelve a disponible → sale de la lista; si estaba sin stock: novedad "reingreso"
--                          y aviso a los clientes que lo esperaban (avisarme)
create or replace function public.tg_stock_marca()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dias int;
begin
  new.actualizado := now();
  if new.marca is not distinct from old.marca then return new; end if;

  if new.marca in ('critico', 'sin_stock') then
    update lista_compras set motivo = new.marca
      where producto_id = new.producto_id and estado <> 'resuelto';
    if not found then
      insert into lista_compras (empresa_id, producto_id, motivo)
      values (new.empresa_id, new.producto_id, new.marca);
    end if;
    if new.marca = 'sin_stock' and not public.sin_novedades() then
      insert into producto_eventos (empresa_id, producto_id, tipo, usuario)
      values (new.empresa_id, new.producto_id, 'sin_stock', auth.uid());
    end if;
  end if;

  if new.marca = 'disponible' then
    update lista_compras set estado = 'resuelto', resuelto_en = now()
      where producto_id = new.producto_id and estado <> 'resuelto';
    if old.marca = 'sin_stock' then
      if not public.sin_novedades() then
        insert into producto_eventos (empresa_id, producto_id, tipo, usuario)
        values (new.empresa_id, new.producto_id, 'reingreso', auth.uid());
      end if;
      select faltantes_vencen_dias into v_dias from empresa_config where empresa_id = new.empresa_id;
      update avisarme set estado = 'avisado', avisado_en = now(),
                          vence = now() + make_interval(days => coalesce(v_dias, 7))
        where producto_id = new.producto_id and estado = 'esperando';
    end if;
  end if;
  return new;
end $$;
create trigger stock_marca before update on public.stock
  for each row execute function public.tg_stock_marca();

-- Pago de abono registrado → avanza abono_pagado_hasta
create or replace function public.tg_pago_abono()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update empresas set abono_pagado_hasta = greatest(coalesce(abono_pagado_hasta, new.mes_hasta), new.mes_hasta)
    where id = new.empresa_id;
  return new;
end $$;
create trigger pago_abono after insert on public.pagos_abono
  for each row execute function public.tg_pago_abono();
