-- Assinaturas Stripe (acesso ao catálogo).
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_user_key unique (user_id),
  constraint subscriptions_stripe_subscription_key unique (stripe_subscription_id)
);

create index subscriptions_status_idx on public.subscriptions (status);
create index subscriptions_stripe_customer_idx on public.subscriptions (stripe_customer_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

create policy subscriptions_select_own on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Webhooks usam service role (ignora RLS).
