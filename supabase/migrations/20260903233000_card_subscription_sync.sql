-- Espelha a assinatura de cartão (Stripe) em public.subscriptions sem passar
-- por cima do razão de créditos pré-pagos (PIX/Asaas).
--
-- Problema que isto resolve: o webhook do cartão gravava status e
-- current_period_end direto na tabela. Quem tinha PIX pago até uma data
-- futura perdia dia pago a cada customer.subscription.updated, e um
-- customer.subscription.deleted zerava o acesso PIX inteiro.
--
-- Cartão e PIX são dinheiros separados: o cartão manda no próprio prazo e no
-- próprio status, mas nunca pode encurtar o que o razão já creditou.

create or replace function public.sync_card_subscription(
  p_user_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_status text,
  p_period_end timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ledger_end timestamptz;
  v_end timestamptz;
  v_status text;
begin
  -- Mesmo lock de grant_prepaid_access: um webhook de cartão e um de PIX do
  -- mesmo usuário não podem recalcular o cache em paralelo.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0::bigint));

  select max(period_end) into v_ledger_end
  from public.payment_grants
  where user_id = p_user_id
    and status = 'granted';

  -- greatest ignora null, então basta um dos dois lados existir.
  v_end := greatest(p_period_end, v_ledger_end);

  v_status := p_status;
  if v_status not in ('active', 'trialing')
     and v_ledger_end is not null
     and v_ledger_end > now() then
    -- Cartão vencido, cancelado ou estornado não derruba crédito PIX válido.
    v_status := 'active';
  end if;

  insert into public.subscriptions (
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    status,
    current_period_end
  )
  values (p_user_id, p_customer_id, p_subscription_id, v_status, v_end)
  on conflict (user_id) do update
    set stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        status = excluded.status,
        current_period_end = excluded.current_period_end;

  return v_end;
end;
$$;

revoke all on function public.sync_card_subscription(uuid, text, text, text, timestamptz)
  from public;
revoke execute on function public.sync_card_subscription(uuid, text, text, text, timestamptz)
  from anon, authenticated;
grant execute on function public.sync_card_subscription(uuid, text, text, text, timestamptz)
  to service_role;
