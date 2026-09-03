import type Stripe from "stripe";
import { logWarn } from "@/lib/logger";
import { knownCardPriceIds } from "@/lib/stripe-plans";
import {
  cardStatusIsActive,
  periodEndToIso,
  subscriptionPeriodEndSeconds,
  subscriptionPriceIds,
  unknownPriceIds,
} from "@/lib/stripe-webhook-events";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Espelho da assinatura de cartão em public.subscriptions.
 *
 * Toda escrita passa pela RPC sync_card_subscription, que aplica o status e o
 * prazo do cartão sem encurtar o crédito pré-pago já registrado em
 * payment_grants. Gravar direto na tabela apagaria acesso PIX pago.
 */

type CardSyncInput = {
  userId: string;
  customerId: string;
  subscriptionId: string | null;
  status: string;
  periodEnd: string | null;
};

async function syncCardSubscription(input: CardSyncInput): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("sync_card_subscription", {
    p_user_id: input.userId,
    p_customer_id: input.customerId,
    p_subscription_id: input.subscriptionId,
    p_status: input.status,
    p_period_end: input.periodEnd,
  });

  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function upsertSubscriptionFromStripe(
  userId: string,
  customerId: string,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const unknown = unknownPriceIds(
    subscriptionPriceIds(subscription),
    knownCardPriceIds(),
  );
  if (unknown.length > 0) {
    logWarn("Stripe: assinatura com price fora do catálogo", {
      subscriptionId: subscription.id,
      priceIds: unknown,
    });
  }

  const periodEnd = periodEndToIso(subscriptionPeriodEndSeconds(subscription));
  if (!periodEnd && cardStatusIsActive(subscription.status)) {
    // Sem prazo, o paywall libera sem data limite. Não bloqueia quem pagou,
    // mas precisa aparecer no log se acontecer.
    logWarn("Stripe: assinatura ativa sem fim de período", {
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  }

  return syncCardSubscription({
    userId,
    customerId,
    subscriptionId: subscription.id,
    status: subscription.status,
    periodEnd,
  });
}

/**
 * Corta o acesso do cartão agora (estorno, chargeback). O crédito PIX do
 * mesmo usuário continua valendo: quem decide é o razão.
 */
export async function revokeCardAccess(input: {
  userId: string;
  customerId: string;
  subscriptionId: string | null;
}): Promise<string | null> {
  return syncCardSubscription({
    userId: input.userId,
    customerId: input.customerId,
    subscriptionId: input.subscriptionId,
    status: "canceled",
    periodEnd: new Date().toISOString(),
  });
}

export type CardSubscriptionRef = {
  userId: string;
  stripeSubscriptionId: string | null;
};

export async function findCardSubscriptionByCustomer(
  customerId: string,
): Promise<CardSubscriptionRef | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id, stripe_subscription_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    userId: data.user_id,
    stripeSubscriptionId: data.stripe_subscription_id,
  };
}

export async function findUserIdByStripeCustomer(
  customerId: string,
): Promise<string | null> {
  const row = await findCardSubscriptionByCustomer(customerId);
  return row?.userId ?? null;
}
