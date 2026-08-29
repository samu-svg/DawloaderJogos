-- Papel e rotação de senha passam a viver em public.profiles, fora do
-- user_metadata (que o cliente autenticado consegue reescrever).
--
-- O e-mail hardcoded da policy de INSERT some: só profiles.role = 'admin'
-- cria portfólio. Promova o primeiro admin com:
--   update public.profiles set role = 'admin' where id = '<uuid>';
-- ou defina PORTFOLIO_ADMIN_EMAIL no app (bootstrap no login).

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

drop policy if exists portfolios_insert_admin on public.portfolios;

create policy portfolios_insert_admin on public.portfolios
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );
