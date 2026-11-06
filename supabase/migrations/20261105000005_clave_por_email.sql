-- =========================================================
-- 5. RECUPERAR LA CLAVE POR EMAIL (05-11-2026)
-- ---------------------------------------------------------
-- Decisión de César: el cliente recupera la clave solo, por email,
-- sin depender de la distribuidora. WhatsApp queda como respaldo
-- (el panel sigue pudiendo generar el código con generar_codigo_reset).
--  · El email pasa a ser obligatorio al crear la cuenta (no se confirma
--    con un link al registrarse para no frenar la compra).
--  · El código llega por mail, vence en 15 minutos y se bloquea a los 5
--    intentos. Máximo 3 mails por hora para un mismo celular.
-- El mail lo manda la Edge Function "reset-clave" (servicio Resend).
-- =========================================================

alter table public.codigos_reset
  add column canal text not null default 'whatsapp' check (canal in ('whatsapp', 'email'));

-- Toda cuenta de cliente tiene email (las fichas "sin cuenta" no)
alter table public.clientes
  add constraint clientes_email_si_tiene_cuenta check (user_id is null or email is not null);

-- Email con formato válido, guardado en minúsculas
create or replace function public.email_valido(p text)
returns boolean language sql immutable as $$
  select p ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
$$;

-- "a***@gmail.com" (lo que se le muestra al pedir el código)
create or replace function public.email_tapado(p text)
returns text language sql immutable as $$
  select left(split_part(p, '@', 1), 1) || '***@' || split_part(p, '@', 2)
$$;


-- registrar_cliente: ahora el email es obligatorio
create or replace function public.registrar_cliente(
  p_empresa uuid, p_nombre text, p_telefono text, p_perfil text,
  p_nombre_negocio text default null, p_entrega text default null, p_email text default null,
  p_acepta_privacidad boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c       empresa_config;
  cli     clientes;
  v_est   text;
  v_email text := lower(trim(p_email));
begin
  if auth.uid() is null then perform public.error_app('sin_sesion'); end if;
  if not p_acepta_privacidad then perform public.error_app('aceptar_privacidad'); end if;
  if p_telefono !~ '^\+[0-9]{10,15}$' then perform public.error_app('telefono_invalido'); end if;
  if v_email is null or not public.email_valido(v_email) then perform public.error_app('email_invalido'); end if;
  if p_perfil not in ('hogar', 'negocio') then perform public.error_app('perfil_invalido'); end if;
  select * into c from empresa_config where empresa_id = p_empresa;
  if not found then perform public.error_app('empresa_inexistente'); end if;
  v_est := case when c.modo_catalogo = 'solo_listado' then 'pendiente' else 'aprobado' end;

  select * into cli from clientes where empresa_id = p_empresa and telefono = p_telefono for update;
  if found then
    if cli.user_id is not null and cli.user_id <> auth.uid() then perform public.error_app('telefono_registrado'); end if;
    update clientes set user_id = auth.uid(), nombre = p_nombre, perfil = p_perfil,
           nombre_negocio = p_nombre_negocio, entrega_preferida = p_entrega, email = v_email,
           estado = case when estado = 'sin_cuenta' then v_est else estado end,
           acepto_privacidad_en = now()
     where id = cli.id;
  else
    insert into clientes (empresa_id, user_id, nombre, telefono, perfil, nombre_negocio,
                          entrega_preferida, email, estado, acepto_privacidad_en)
    values (p_empresa, auth.uid(), p_nombre, p_telefono, p_perfil, p_nombre_negocio,
            p_entrega, v_email, v_est, now());
  end if;
  select * into cli from clientes where empresa_id = p_empresa and telefono = p_telefono;
  return jsonb_build_object('cliente_id', cli.id, 'estado', cli.estado);
end $$;


-- El cliente cambia su email desde la app (por ejemplo, si lo escribió mal)
create or replace function public.cambiar_mi_email(p_empresa uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(p_email));
begin
  if not public.email_valido(v_email) then perform public.error_app('email_invalido'); end if;
  update clientes set email = v_email where empresa_id = p_empresa and user_id = auth.uid();
  if not found then perform public.error_app('registrate_primero'); end if;
end $$;


-- Lo usa SOLO la Edge Function "reset-clave": crea el código y devuelve a quién mandarlo.
-- Si el celular no tiene cuenta devuelve null y no se manda nada.
create or replace function public.crear_codigo_reset_email(p_empresa uuid, p_telefono text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  cli      clientes;
  v_codigo text;
begin
  select * into cli from clientes
   where empresa_id = p_empresa and telefono = p_telefono and user_id is not null and email is not null;
  if not found then return null; end if;

  if (select count(*) from codigos_reset
       where cliente_id = cli.id and canal = 'email' and creado > now() - interval '1 hour') >= 3 then
    perform public.error_app('demasiados_pedidos');
  end if;

  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1), '')
    into v_codigo from generate_series(1, 6);

  update codigos_reset set usado_en = now() where cliente_id = cli.id and usado_en is null;
  insert into codigos_reset (empresa_id, cliente_id, codigo_hash, vence, canal)
  values (p_empresa, cli.id, crypt(v_codigo, gen_salt('bf')), now() + interval '15 minutes', 'email');

  return jsonb_build_object(
    'email', cli.email, 'email_tapado', public.email_tapado(cli.email),
    'nombre', cli.nombre, 'codigo', v_codigo,
    'empresa', (select nombre from empresas where id = p_empresa));
end $$;

-- Busca la distribuidora por su slug (lo usan las Edge Functions)
create or replace function public.empresa_por_slug(p_slug text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from empresas where slug = p_slug
$$;


-- Permisos
revoke execute on function public.email_valido(text), public.email_tapado(text),
                           public.cambiar_mi_email(uuid, text),
                           public.crear_codigo_reset_email(uuid, text),
                           public.empresa_por_slug(text)
  from public, anon, authenticated;
grant execute on function public.cambiar_mi_email(uuid, text) to authenticated;
grant execute on function public.crear_codigo_reset_email(uuid, text), public.empresa_por_slug(text) to service_role;
