-- HD registrado por assinatura (1 HD por plano pessoal).
create table public.user_hds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fingerprint text not null,
  label text,
  registered_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  constraint user_hds_user_fingerprint_key unique (user_id, fingerprint)
);

create index user_hds_user_id_idx on public.user_hds (user_id);

alter table public.user_hds enable row level security;

create policy user_hds_select_own on public.user_hds
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Escrita via service role (manifest-token).
