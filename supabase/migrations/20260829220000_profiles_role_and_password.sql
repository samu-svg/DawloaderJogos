-- Papel e rotação de senha passam a viver em public.profiles, fora do
-- user_metadata (que o cliente autenticado consegue reescrever).
--
-- O e-mail hardcoded da policy de INSERT some: só profiles.role = 'admin'
-- cria portfólio. Promova o primeiro admin com:
--   update public.profiles set role = 'admin' where id = '<uuid>';
-- ou defina PORTFOLIO_ADMIN_EMAIL no app (bootstrap no login).
--
-- IMPORTANTE: aplique o UPDATE de admin antes ou logo após esta migration.
-- A policy antiga (e-mail hardcoded) deixa de existir; sem role = 'admin'
-- ninguém cria portfólio pelo painel.

alter table public.profiles
  add column if not exists role text not null default 'user',
  add column if not exists password_changed_at timestamptz not null default now();

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'editor', 'user'));

-- Authenticated may only change display_name. Role and password_changed_at
-- stay writable by service_role / postgres.
revoke update on table public.profiles from anon, authenticated;
grant update (display_name) on table public.profiles to authenticated;

drop policy if exists profiles_update_own on public.profiles;

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role, password_changed_at)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1)
    ),
    'user',
    now()
  );
  return new;
end;
$$;

-- is_admin() fica em schema NÃO exposto (private). SECURITY DEFINER em public
-- seria invocável por RPC (POST /rest/v1/rpc/is_admin) por qualquer
-- authenticated — ver Supabase docs sobre funções definer em schemas expostos.
--
-- A policy de portfolios avalia a expressão com o papel do usuário que faz o
-- INSERT; authenticated precisa de USAGE no schema e EXECUTE na função, mas
-- isso NÃO expõe a RPC: PostgREST só lista schemas em Settings → API →
-- Exposed schemas (default: public, graphql_public). Não adicione private ali.
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
revoke execute on function private.is_admin() from anon;
grant execute on function private.is_admin() to authenticated;

-- Versão anterior (se reaplicar em staging): remover de public.
drop function if exists public.is_admin();

drop policy if exists portfolios_insert_admin on public.portfolios;

create policy portfolios_insert_admin on public.portfolios
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and (select private.is_admin())
  );
