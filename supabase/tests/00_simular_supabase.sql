-- =========================================================
-- SOLO PARA PROBAR EN UNA BASE LOCAL (no se pega en Supabase)
-- Imita lo mínimo que Supabase ya trae: roles, esquema auth,
-- auth.uid() y el esquema extensions con pgcrypto.
-- =========================================================

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  phone text,
  created_at timestamptz default now()
);

-- En Supabase, auth.uid() lee el usuario del token. Acá lo leemos de una variable.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant select on auth.users to service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
