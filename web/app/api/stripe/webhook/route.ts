import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { recordAudit } from "@/lib/audit";
import { logError, logWarn } from "@/lib/logger";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getStripe, subscriptionsEnabled } from "@/lib/stripe";
import { userIdFromCheckoutSession } from "@/lib/stripe-access";
import {
  chargeRefundKind,
  stripeEventAction,
  type RefundKind,
} from "@/lib/stripe-webhook-events";
import {
  findCardSubscriptionByCustomer,
  findUserIdByStripeCustomer,
  revokeCardAccess,
  upsertSubscriptionFromStripe,
} from "@/lib/stripe-subscription-sync";

export const runtime = "nodejs";

function customerIdOf(
  customer: string | { id: string } | null | undefined,
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

async function handleCheckout(stripe: Stripe, session: Stripe.Checkout.Session) {
  // Cartão é sempre assinatura. `mode: "payment"` era o PIX antigo via Stripe;
  // hoje só chega se alguém criar cobrança avulsa no painel, e creditar acesso
  // por esse caminho ficava fora do razão e sem idempotência.
  if (session.mode !== "subscription") {
    logWarn("Stripe: checkout fora do fluxo de assinatura, nada creditado", {
      sessionId: session.id,
      mode: session.mode,
    });
    await recordAudit({
      actorId: userIdFromCheckoutSession(session),
      action: "stripe.checkout.unsupported_mode",
      entity: "subscription",
      entityId: session.id,
      metadata: { mode: session.mode ?? null },
    });
    return;
  }

  if (!session.subscription) return;

  const userId = userIdFromCheckoutSession(session);
  if (!userId) {
    logWarn("Stripe: checkout sem usuário identificado", { sessionId: session.id });
    return;
  }

  // Relê na API: o objeto do evento é um retrato do passado.
  const subscription = await stripe.subscriptions.retrieve(
    String(session.subscription),
  );
  const customerId = customerIdOf(subscription.customer);
  if (!customerId) {
    logWarn("Stripe: assinatura sem customer", { subscriptionId: subscription.id });
    return;
  }

  await upsertSubscriptionFromStripe(userId, customerId, subscription);
  await recordAudit({
    actorId: userId,
    action: "stripe.checkout.completed",
    entity: "subscription",
    entityId: subscription.id,
    metadata: { status: subscription.status },
  });
}

async function handleSubscriptionEvent(stripe: Stripe, subscriptionId: string) {
  // O Stripe não garante ordem de entrega: um "updated" antigo chegando depois
  // do "deleted" ressuscitaria o acesso. Reler pelo id resolve, porque grava
  // sempre o estado atual da assinatura, não o do evento.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = customerIdOf(subscription.customer);
  if (!customerId) {
    logWarn("Stripe: assinatura sem customer", { subscriptionId });
    return;
  }

  const userId =
    subscription.metadata.app_user_id ??
    subscription.metadata.supabase_user_id ??
    (await findUserIdByStripeCustomer(customerId));

  if (!userId) {
    logWarn("Stripe: assinatura sem usuário conhecido", { subscriptionId, customerId });
    return;
  }

  await upsertSubscriptionFromStripe(userId, customerId, subscription);
  await recordAudit({
    actorId: userId,
    action: "stripe.subscription_sync",
    entity: "subscription",
    entityId: subscription.id,
    metadata: { status: subscription.status },
  });
}

/**
 * Estorno e chargeback cortam o acesso na hora e encerram a recorrência. Sem
 * isso o cliente segue com o app liberado depois de reverter o pagamento, e o
 * Stripe não cancela a assinatura por conta própria em disputa.
 */
async function handleChargeReversal(
  stripe: Stripe,
  charge: Stripe.Charge,
  kind: "refund" | "dispute",
  refund: RefundKind,
) {
  const customerId = customerIdOf(charge.customer);
  if (!customerId) {
    logWarn("Stripe: estorno sem customer, revisar à mão", {
      chargeId: charge.id,
      kind,
    });
    return;
  }

  const row = await findCardSubscriptionByCustomer(customerId);
  if (!row) {
    logWarn("Stripe: estorno de customer sem assinatura local", {
      chargeId: charge.id,
      customerId,
      kind,
    });
    return;
  }

  if (row.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(row.stripeSubscriptionId);
    } catch (error) {
      // Reenvio do evento cai aqui: a assinatura já está cancelada.
      logWarn("Stripe: assinatura não cancelada no estorno", {
        subscriptionId: row.stripeSubscriptionId,
        chargeId: charge.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await revokeCardAccess({
    userId: row.userId,
    customerId,
    subscriptionId: row.stripeSubscriptionId,
  });

  await recordAudit({
    actorId: row.userId,
    action: kind === "dispute" ? "stripe.charge.disputed" : "stripe.charge.refunded",
    entity: "subscription",
    entityId: charge.id,
    metadata: {
      refund,
      amount: charge.amount ?? 0,
      amountRefunded: charge.amount_refunded ?? 0,
    },
  });
}

async function handleDispute(stripe: Stripe, dispute: Stripe.Dispute) {
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!chargeId) {
    logWarn("Stripe: disputa sem cobrança", { disputeId: dispute.id });
    return;
  }

  const charge = await stripe.charges.retrieve(chargeId);
  await handleChargeReversal(stripe, charge, "dispute", "full");
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "stripe-webhook", RATE_LIMITS.medium);
  if (limited) return limited;

  if (!subscriptionsEnabled()) {
    return NextResponse.json({ error: "Pagamentos desativados." }, { status: 503 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Assinatura ausente." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    logError("Stripe webhook signature invalid", error);
    return NextResponse.json(
      { error: "Assinatura do webhook inválida." },
      { status: 400 },
    );
  }

  try {
    switch (stripeEventAction(event.type)) {
      case "checkout": {
        await handleCheckout(stripe, event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "subscription": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionEvent(stripe, subscription.id);
        break;
      }
      case "refund": {
        const charge = event.data.object as Stripe.Charge;
        const refund = chargeRefundKind(charge);
        if (refund === "none") break;
        await handleChargeReversal(stripe, charge, "refund", refund);
        break;
      }
      case "dispute": {
        await handleDispute(stripe, event.data.object as Stripe.Dispute);
        break;
      }
      case "payment_failed": {
        // O Stripe move a assinatura para past_due e emite
        // customer.subscription.updated, que é quem ajusta o acesso.
        const invoice = event.data.object as Stripe.Invoice;
        logWarn("Stripe: fatura não paga", { invoiceId: invoice.id });
        await recordAudit({
          action: "stripe.invoice.payment_failed",
          entity: "subscription",
          entityId: invoice.id ?? undefined,
          metadata: { customer: customerIdOf(invoice.customer) },
        });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    logError("Stripe webhook handler failed", error, {
      eventId: event.id,
      type: event.type,
    });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
