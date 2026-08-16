create type source_kind as enum ('hosted', 'external');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolios_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$')
);

create unique index portfolios_slug_key on public.portfolios (slug);
create index portfolios_owner_idx on public.portfolios (owner_id);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  label text not null,
  destination text not null,
  size_bytes bigint not null default 0,
  sha256 text,
  kind source_kind not null,
  storage_key text,
  external_url text,
  is_optional boolean not null default false,
  group_name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint entries_source_present check (
    (kind = 'hosted' and storage_key is not null)
    or (kind = 'external' and external_url is not null)
  ),
  constraint entries_sha256_format check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  -- Last line of defence: the destination must stay inside the root folder the
  -- user picks in the desktop client.
  constraint entries_destination_length check (char_length(destination) between 1 and 200),
  constraint entries_destination_no_backslash check (strpos(destination, chr(92)) = 0),
  constraint entries_destination_relative check (
    destination !~ '^/'
    and destination !~ '^[A-Za-z]:'
    and destination !~ '(^|/)[.][.]?(/|$)'
  )
);

create index entries_portfolio_idx on public.entries (portfolio_id, sort_order);
-- Two entries pointing at the same path would overwrite each other on disk.
create unique index entries_destination_key on public.entries (portfolio_id, lower(destination));

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger portfolios_set_updated_at
  before update on public.portfolios
  for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.entries enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy portfolios_select_public on public.portfolios
  for select to anon, authenticated using (is_public);

create policy portfolios_select_own on public.portfolios
  for select to authenticated using ((select auth.uid()) = owner_id);

create policy portfolios_insert_own on public.portfolios
  for insert to authenticated with check ((select auth.uid()) = owner_id);

create policy portfolios_update_own on public.portfolios
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy portfolios_delete_own on public.portfolios
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy entries_select_public on public.entries
  for select to anon, authenticated using (
    exists (
      select 1 from public.portfolios p
      where p.id = entries.portfolio_id and p.is_public
    )
  );

create policy entries_all_own on public.entries
  for all to authenticated
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = entries.portfolio_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = entries.portfolio_id and p.owner_id = (select auth.uid())
    )
  );
