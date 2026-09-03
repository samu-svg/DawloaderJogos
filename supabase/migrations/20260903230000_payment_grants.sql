-- Razão de créditos pré-pagos (PIX/Asaas).
--
-- Problema que isto resolve: a concessão de acesso era idempotente apenas
-- contra o ÚLTIMO pagamento gravado em subscriptions.stripe_subscription_id.
-- Com dois pagamentos pagos no histórico, reabrir /assinar/pix?payment=<id>
-- alternando entre eles creditava acesso indefinidamente, de graça.
--
-- Agora cada crédito é uma linha aqui, única por (provider, payment_id). O
-- mesmo pagamento nunca credita duas vezes, e subscriptions passa a ser só
-- um cache derivado do razão.

create table public.payment_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  payment_id text not null,
  plan_id text not null,
  months integer not null,
  amount_cents integer not null,
  status text not null default 'granted',
  -- Janela que ESTE pagamento adicionou. Concessões encadeiam: period_start é
  -- o vencimento vigente, então renovar antes de vencer não apaga dia pago.
  period_start timestamptz not null,
  period_end timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_grants_provider_payment_key unique (provider, payment_id),
  constraint payment_grants_provider_check check (provider in ('asaas', 'stripe')),
  constraint payment_grants_status_check check (status in ('granted', 'revoked')),
  constraint payment_grants_months_check check (months between 1 and 24),
  constraint payment_grants_amount_check check (amount_cents > 0),
  constraint payment_grants_period_check check (period_end > period_start),
  constraint payment_grants_payment_id_len check (char_length(payment_id) between 1 and 120),
  constraint payment_grants_plan_id_len check (char_length(plan_id) between 1 and 20)
);

create index payment_grants_user_status_idx
  on public.payment_grants (user_id, status, period_end desc);

create trigger payment_grants_set_updated_at
  before update on public.payment_grants
  for each row execute function public.set_updated_at();

-- RLS sem policy: ninguém lê pelo PostgREST. O usuário vê o próprio acesso
-- por public.subscriptions, que já tem policy de SELECT do dono.
alter table public.payment_grants enable row level security;
revoke all on table public.payment_grants from anon, authenticated, public;

-- Recalcula o cache em public.subscriptions a partir do razão.
--
-- SECURITY DEFINER em schema exposto é invocável por RPC, então o EXECUTE é
-- revogado de anon/authenticated e concedido só ao service_role (webhook).
create or replace function public.sync_prepaid_subscription(
  p_user_id uuid,
  p_customer_ref text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ledger_end timestamptz;
  v_row public.subscriptions;
  v_end timestamptz;
  v_customer text;
  v_status text;
begin
  select max(period_end) into v_ledger_end
  from public.payment_grants
  where user_id = p_user_id
    and status = 'granted';

  select * into v_row
  from public.subscriptions
  where user_id = p_user_id;

  -- Assinatura recorrente do Stripe convive com PIX pré-pago. Nesse caso o
  -- cartão manda no status e o razão só pode ESTENDER o prazo: sincronizar o
  -- razão não pode derrubar (nem promover) quem paga no cartão.
  -- starts_with e não LIKE: em 'sub_%' o underscore é curinga de um caractere.
  if starts_with(v_row.stripe_subscription_id, 'sub_') then
    if v_ledger_end is null
      or (v_row.current_period_end is not null
          and v_ledger_end <= v_row.current_period_end) then
      return v_row.current_period_end;
    end if;
    v_end := v_ledger_end;
    v_status := 'active';
  else
    v_end := v_ledger_end;
    v_status := case
      when v_end is not null and v_end > now() then 'active'
      else 'canceled'
    end;
  end if;

  -- Não troca um customer real do Stripe pela referência do Asaas.
  v_customer := v_row.stripe_customer_id;
  if v_customer is null or not starts_with(v_customer, 'cus_') then
    v_customer := coalesce(p_customer_ref, v_customer, 'asaas:desconhecido');
  end if;

  insert into public.subscriptions (
    user_id,
    stripe_customer_id,
    status,
    current_period_end
  )
  values (p_user_id, v_customer, v_status, v_end)
  on conflict (user_id) do update
    set stripe_customer_id = excluded.stripe_customer_id,
        status = excluded.status,
        current_period_end = excluded.current_period_end;

  return v_end;
end;
$$;

revoke all on function public.sync_prepaid_subscription(uuid, text) from public;
revoke execute on function public.sync_prepaid_subscription(uuid, text) from anon, authenticated;
grant execute on function public.sync_prepaid_subscription(uuid, text) to service_role;

-- Credita meses uma única vez por pagamento e devolve o novo vencimento.
create or replace function public.grant_prepaid_access(
  p_user_id uuid,
  p_provider text,
  p_payment_id text,
  p_plan_id text,
  p_months integer,
  p_amount_cents integer,
  p_customer_ref text
)
returns table (new_period_end timestamptz, was_created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base timestamptz;
  v_end timestamptz;
begin
  -- Serializa concessões do mesmo usuário: dois webhooks simultâneos não
  -- podem ler o mesmo vencimento base e gerar janelas sobrepostas.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0::bigint));

  -- Idempotência: o mesmo pagamento nunca credita duas vezes.
  if exists (
    select 1
    from public.payment_grants
    where provider = p_provider
      and payment_id = p_payment_id
  ) then
    return query
      select public.sync_prepaid_subscription(p_user_id, p_customer_ref), false;
    return;
  end if;

  select max(period_end) into v_base
  from public.payment_grants
  where user_id = p_user_id
    and status = 'granted';

  v_base := greatest(coalesce(v_base, now()), now());
  v_end := v_base + make_interval(months => p_months);

  insert into public.payment_grants (
    user_id,
    provider,
    payment_id,
    plan_id,
    months,
    amount_cents,
    period_start,
    period_end
  )
  values (
    p_user_id,
    p_provider,
    p_payment_id,
    p_plan_id,
    p_months,
    p_amount_cents,
    v_base,
    v_end
  );

  return query
    select public.sync_prepaid_subscription(p_user_id, p_customer_ref), true;
end;
$$;

revoke all on function public.grant_prepaid_access(uuid, text, text, text, integer, integer, text) from public;
revoke execute on function public.grant_prepaid_access(uuid, text, text, text, integer, integer, text) from anon, authenticated;
grant execute on function public.grant_prepaid_access(uuid, text, text, text, integer, integer, text) to service_role;

-- Estorno / chargeback: marca o crédito como revogado e recalcula o acesso.
create or replace function public.revoke_prepaid_access(
  p_provider text,
  p_payment_id text,
  p_reason text
)
returns table (new_period_end timestamptz, was_revoked boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.payment_grants
  where provider = p_provider
    and payment_id = p_payment_id
    and status = 'granted'
  for update;

  -- Reenvio de um estorno já processado cai aqui e não faz nada.
  if v_user_id is null then
    return query select null::timestamptz, false;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0::bigint));

  update public.payment_grants
  set status = 'revoked',
      revoked_at = now(),
      revoked_reason = left(coalesce(p_reason, 'revogado'), 200)
  where provider = p_provider
    and payment_id = p_payment_id;

  return query
    select public.sync_prepaid_subscription(v_user_id, null), true;
end;
$$;

revoke all on function public.revoke_prepaid_access(text, text, text) from public;
revoke execute on function public.revoke_prepaid_access(text, text, text) from anon, authenticated;
grant execute on function public.revoke_prepaid_access(text, text, text) to service_role;
