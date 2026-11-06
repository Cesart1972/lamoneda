-- =========================================================
-- 4. SEGURIDAD (Row Level Security)
-- ---------------------------------------------------------
-- Regla de oro: cada fila solo la ve quien corresponde.
--  · Datos de una distribuidora → solo sus miembros (según su rol).
--  · Cliente → solo lo suyo. Nunca escribe directo en pedidos ni stock:
--    lo hace a través de las funciones del archivo 3.
--  · Ces.Art (dueño de plataforma / cobrador) → abonos y cobros;
--    nunca pedidos, clientes ni precios de las distribuidoras.
--  · Visitante sin cuenta → solo el catálogo (catalogo_publico).
-- Supabase da permisos amplios por defecto: acá se cierran y se abren de a uno.
-- =========================================================

-- ---------------------------------------------------------
-- Cerrar todo
-- ---------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
-- Las funciones "security definer" corren como el dueño de las tablas y
-- controlan los permisos adentro; por eso no quedan frenadas por estas reglas.


-- ---------------------------------------------------------
-- Funciones que puede llamar cada uno
-- ---------------------------------------------------------

-- Auxiliares que usan las reglas (las llaman todos)
grant execute on function
  public.es_dueno_plataforma(), public.es_cobrador_de(uuid), public.mis_roles(uuid),
  public.tiene_rol(uuid, text[]), public.es_miembro(uuid), public.mi_cliente(uuid),
  public.puede_ver_costos(uuid), public.puede_editar_config(uuid), public.hoy(uuid),
  public.estado_abono(uuid), public.puede_ver_precios(uuid), public.catalogo_visible(uuid),
  public.sin_novedades()
to anon, authenticated;

-- Visitante sin cuenta
grant execute on function public.catalogo_publico(text) to anon, authenticated;

-- Usuarios conectados (cada función controla adentro el rol que hace falta)
grant execute on function
  public.crear_pedido(uuid, jsonb, uuid, numeric, text, text),
  public.pegar_pedido(uuid, text, text, jsonb, text),
  public.iniciar_armado(bigint),
  public.item_entregadas(bigint, int),
  public.item_hecho(bigint, boolean),
  public.agregar_item(bigint, bigint, int, int),
  public.quitar_item(bigint),
  public.marcar_critico(bigint, int),
  public.marcar_sin_stock(bigint),
  public.quitar_marca(bigint),
  public.enviar_pedido(bigint),
  public.cambiar_estado_pedido(bigint, text, text),
  public.marcar_pago(bigint, text, text),
  public.ajustar_stock(bigint, int, text, uuid),
  public.cambiar_marca(bigint, text),
  public.activar_limite_stock(uuid, boolean),
  public.crear_compra(uuid),
  public.comprar_desde_lista(uuid, bigint),
  public.registrar_compra(bigint),
  public.registrar_cliente(uuid, text, text, text, text, text, text, boolean),
  public.aprobar_cliente(bigint, text),
  public.verificar_telefono(bigint),
  public.generar_codigo_reset(bigint),
  public.avisame(bigint),
  public.descartar_faltante(bigint),
  public.clientes_con_faltantes(uuid, bigint),
  public.mis_novedades(uuid),
  public.borrar_novedades(uuid),
  public.novedades_vistas_ahora(uuid),
  public.mi_abono(uuid, int),
  public.cobro_preview(uuid),
  public.registrar_cobro_efectivo(uuid, text, double precision, double precision),
  public.crear_rendicion(),
  public.confirmar_rendicion(bigint, numeric, text),
  public.informe_ventas(uuid, date, date),
  public.informe_productos(uuid, date, date),
  public.importar_productos(uuid, jsonb, boolean)
to authenticated;

-- Solo la Edge Function "reset-clave" (clave de servicio)
grant execute on function public.validar_codigo_reset(uuid, text, text) to service_role;


-- ---------------------------------------------------------
-- Permisos de tabla (lo que pase además tiene que cumplir las reglas de abajo)
-- ---------------------------------------------------------
grant select on public.categorias, public.lineas, public.productos,
                public.producto_precios, public.ofertas to anon;

grant select on all tables in schema public to authenticated;
grant insert, update, delete on
  public.empresas, public.plataforma_miembros, public.cobrador_empresas, public.pagos_abono,
  public.empresa_config, public.miembros,
  public.categorias, public.proveedores, public.lineas, public.productos,
  public.producto_precios, public.ofertas, public.producto_costos,
  public.lista_compras, public.compras, public.compra_items,
  public.direcciones, public.favoritos, public.push_suscripciones,
  public.novedades_reglas
to authenticated;

-- Pedidos y clientes: desde el panel solo se pueden tocar estos campos.
-- Estado, totales, cliente, etc. cambian únicamente con las funciones.
grant update (notas_internas, horario_entrega) on public.pedidos to authenticated;
grant update (nombre, perfil, nombre_negocio, notas) on public.clientes to authenticated;

-- "Limitar al stock" se enciende solo con activar_limite_stock (que audita antes)
create or replace function public.tg_config_limite()
returns trigger language plpgsql as $$
begin
  if new.limitar_al_stock and not old.limitar_al_stock
     and coalesce(current_setting('app.activando_limite', true), '') <> 'on' then
    raise exception 'usar_activar_limite_stock' using errcode = 'P0001';
  end if;
  new.actualizado := now();
  return new;
end $$;
create trigger config_limite before update on public.empresa_config
  for each row execute function public.tg_config_limite();


-- =========================================================
-- REGLAS POR TABLA
-- =========================================================

-- ---------- Plataforma Ces.Art ----------
create policy ver on public.plataforma_miembros for select to authenticated
  using (user_id = auth.uid() or public.es_dueno_plataforma());
create policy editar on public.plataforma_miembros for all to authenticated
  using (public.es_dueno_plataforma()) with check (public.es_dueno_plataforma());

create policy ver on public.empresas for select to authenticated
  using (public.es_dueno_plataforma() or public.es_cobrador_de(id) or public.es_miembro(id));
create policy editar on public.empresas for all to authenticated
  using (public.es_dueno_plataforma()) with check (public.es_dueno_plataforma());

create policy ver on public.cobrador_empresas for select to authenticated
  using (cobrador_id = auth.uid() or public.es_dueno_plataforma());
create policy editar on public.cobrador_empresas for all to authenticated
  using (public.es_dueno_plataforma()) with check (public.es_dueno_plataforma());

-- El código de pago lo ve SOLO el dueño de esa distribuidora (ni el cobrador)
create policy ver on public.codigos_pago_abono for select to authenticated
  using (public.tiene_rol(empresa_id, '{dueno}'));

create policy ver on public.pagos_abono for select to authenticated
  using (public.es_dueno_plataforma() or cobrador_id = auth.uid() or public.tiene_rol(empresa_id, '{dueno}'));
-- Pagos que no son en efectivo (transferencia, Mercado Pago): los carga Ces.Art
create policy cargar on public.pagos_abono for insert to authenticated
  with check (public.es_dueno_plataforma() and medio <> 'efectivo');

create policy ver on public.rendiciones for select to authenticated
  using (cobrador_id = auth.uid() or public.es_dueno_plataforma());


-- ---------- Configuración y usuarios del panel ----------
create policy ver on public.empresa_config for select to authenticated
  using (public.es_miembro(empresa_id) or public.es_dueno_plataforma());
create policy editar on public.empresa_config for update to authenticated
  using (public.puede_editar_config(empresa_id) or public.es_dueno_plataforma())
  with check (public.puede_editar_config(empresa_id) or public.es_dueno_plataforma());

create policy ver on public.miembros for select to authenticated
  using (public.es_miembro(empresa_id) or public.es_dueno_plataforma());
-- Alta/baja de usuarios: solo el dueño de la distribuidora (o Ces.Art para dar de alta al primer dueño)
create policy editar on public.miembros for all to authenticated
  using (public.tiene_rol(empresa_id, '{dueno}') or public.es_dueno_plataforma())
  with check (public.tiene_rol(empresa_id, '{dueno}') or public.es_dueno_plataforma());


-- ---------- Catálogo ----------
-- Lo ve cualquiera (mientras el abono no tenga el catálogo oculto); lo edita quien mantiene la app
create policy ver on public.categorias for select to anon, authenticated using (public.catalogo_visible(empresa_id));
create policy editar on public.categorias for all to authenticated
  using (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'))
  with check (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'));

create policy ver on public.lineas for select to anon, authenticated using (public.catalogo_visible(empresa_id));
create policy editar on public.lineas for all to authenticated
  using (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'))
  with check (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'));

create policy ver on public.productos for select to anon, authenticated
  using (public.catalogo_visible(empresa_id) and (visible or public.es_miembro(empresa_id)));
create policy editar on public.productos for all to authenticated
  using (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'))
  with check (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'));

create policy ver on public.proveedores for select to authenticated using (public.es_miembro(empresa_id));
create policy editar on public.proveedores for all to authenticated
  using (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'))
  with check (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'));

-- Precios y ofertas: en modo "solo listado", solo clientes aprobados y miembros
create policy ver on public.producto_precios for select to anon, authenticated using (public.puede_ver_precios(empresa_id));
create policy editar on public.producto_precios for all to authenticated
  using (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'))
  with check (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'));

create policy ver on public.ofertas for select to anon, authenticated using (public.puede_ver_precios(empresa_id));
create policy editar on public.ofertas for all to authenticated
  using (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'))
  with check (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'));

-- Costos: solo dueño (y encargado si el dueño lo permite)
create policy ver on public.producto_costos for select to authenticated using (public.puede_ver_costos(empresa_id));
create policy editar on public.producto_costos for all to authenticated
  using (public.puede_ver_costos(empresa_id)) with check (public.puede_ver_costos(empresa_id));


-- ---------- Stock, lista de compras y compras ----------
-- El stock se cambia solo con funciones (ajustar_stock, armado, compras)
create policy ver on public.stock for select to authenticated using (public.es_miembro(empresa_id));
create policy ver on public.stock_movimientos for select to authenticated using (public.es_miembro(empresa_id));

create policy ver on public.lista_compras for select to authenticated using (public.es_miembro(empresa_id));
create policy editar on public.lista_compras for all to authenticated
  using (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'))
  with check (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'));

create policy ver on public.compras for select to authenticated
  using (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'));
-- Mientras está en borrador se puede editar; registrada queda fija
create policy editar on public.compras for update to authenticated
  using (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}') and estado = 'borrador')
  with check (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}') and estado = 'borrador');
create policy borrar on public.compras for delete to authenticated
  using (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}') and estado = 'borrador');

create policy ver on public.compra_items for select to authenticated
  using (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}'));
create policy editar on public.compra_items for all to authenticated
  using (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}')
         and exists (select 1 from public.compras co where co.id = compra_id and co.estado = 'borrador'))
  with check (public.tiene_rol(empresa_id, '{dueno,encargado,catalogo}')
              and exists (select 1 from public.compras co where co.id = compra_id
                          and co.estado = 'borrador' and co.empresa_id = compra_items.empresa_id));


-- ---------- Clientes ----------
-- El cliente ve su ficha; los cambios de su perfil van por registrar_cliente
create policy ver on public.clientes for select to authenticated
  using (user_id = auth.uid() or public.es_miembro(empresa_id));
create policy editar on public.clientes for update to authenticated
  using (public.tiene_rol(empresa_id, '{dueno,encargado}'))
  with check (public.tiene_rol(empresa_id, '{dueno,encargado}'));

create policy ver on public.direcciones for select to authenticated
  using (cliente_id = public.mi_cliente(empresa_id) or public.es_miembro(empresa_id));
create policy editar on public.direcciones for all to authenticated
  using (cliente_id = public.mi_cliente(empresa_id))
  with check (cliente_id = public.mi_cliente(empresa_id));

create policy propios on public.favoritos for all to authenticated
  using (cliente_id = public.mi_cliente(empresa_id))
  with check (cliente_id = public.mi_cliente(empresa_id)
              and exists (select 1 from public.productos p where p.id = producto_id and p.empresa_id = favoritos.empresa_id));
create policy ver_panel on public.favoritos for select to authenticated using (public.es_miembro(empresa_id));

create policy propios on public.push_suscripciones for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy ver on public.avisarme for select to authenticated
  using (cliente_id = public.mi_cliente(empresa_id) or public.es_miembro(empresa_id));

create policy propias on public.novedades_vistas for select to authenticated
  using (exists (select 1 from public.clientes c where c.id = cliente_id and c.user_id = auth.uid()));


-- ---------- Pedidos ----------
-- El cliente ve sus pedidos hechos desde la app. Los que la distribuidora
-- cargó por WhatsApp (ficha "sin cuenta") recién los ve cuando su teléfono
-- está verificado: así nadie ve el historial de otro registrándose con su número.
create policy ver on public.pedidos for select to authenticated
  using (public.es_miembro(empresa_id)
         or exists (select 1 from public.clientes c
                     where c.id = pedidos.cliente_id and c.user_id = auth.uid()
                       and (pedidos.origen = 'app' or c.telefono_verificado)));
-- Notas internas y horario: los toca quien arma
create policy editar on public.pedidos for update to authenticated
  using (public.tiene_rol(empresa_id, '{dueno,encargado,armado}'))
  with check (public.tiene_rol(empresa_id, '{dueno,encargado,armado}'));

create policy ver on public.pedido_items for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id));   -- hereda la regla de pedidos

create policy ver on public.pedido_items_costos for select to authenticated
  using (public.puede_ver_costos(empresa_id));

create policy ver on public.pedido_eventos for select to authenticated using (public.es_miembro(empresa_id));


-- ---------- Novedades ----------
create policy ver on public.producto_eventos for select to authenticated using (public.es_miembro(empresa_id));

create policy ver on public.novedades_reglas for select to authenticated using (public.es_miembro(empresa_id));
create policy editar on public.novedades_reglas for update to authenticated
  using (public.puede_editar_config(empresa_id)) with check (public.puede_editar_config(empresa_id));

-- contadores y codigos_reset: sin reglas → nadie los lee directo (solo las funciones)
