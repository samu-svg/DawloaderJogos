import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { recordAudit } from "@/lib/audit";
import { logError } from "@/lib/logger";
import { getStripe, subscriptionsEnabled } from "@/lib/stripe";
import {
  checkoutSessionGrantsLifetimeAccess,
  userIdFromCheckoutSession,
  userIdFromPaymentIntent,
} from "@/lib/stripe-access";
import {
  findUserIdByStripeCustomer,
  upsertLifetimeAccessFromPayment,
  upsertSubscriptionFromStripe,
} from "@/lib/stripe-subscription-sync";

export const runtime = "nodejs";

async function grantLifetimeAccess(userId: string, customerId: string, entityId: string) {
  await upsertLifetimeAccessFromPayment(userId, customerId);
  await recordAudit({
    actorId: userId,
    action: "stripe.payment.completed",
    entity: "subscription",
    entityId,
    metadata: { status: "active", kind: "one_time" },
  });
}

async function unlockFromCheckoutSession(session: Stripe.Checkout.Session) {
  if (!checkoutSessionGrantsLifetimeAccess(session)) return;

  const userId =
    userIdFromCheckoutSession(session) ??
    (session.customer
      ? await findUserIdByStripeCustomer(String(session.customer))
      : null);

  if (!userId || !session.customer) return;

  await grantLifetimeAccess(userId, String(session.customer), session.id);
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId =
    subscription.metadata.app_user_id ??
    subscription.metadata.supabase_user_id ??
    (await findUserIdByStripeCustomer(subscription.customer as string));

  if (!userId) return;

  await upsertSubscriptionFromStripe(
    userId,
    subscription.customer as string,
    subscription,
  );
  await recordAudit({
    actorId: userId,
    action: "stripe.subscription_sync",
    entity: "subscription",
    entityId: subscription.id,
    metadata: { status: subscription.status },
  });
}

export async function POST(request: Request) {
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
    const message = error instanceof Error ? error.message : "Webhook inválido";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "payment") {
          await unlockFromCheckoutSession(session);
          break;
        }
        if (
          session.mode === "subscription" &&
          session.subscription &&
          session.client_reference_id
        ) {
          const subscription = await stripe.subscriptions.retrieve(
            String(session.subscription),
          );
          await upsertSubscriptionFromStripe(
            session.client_reference_id,
            String(session.customer),
            subscription,
          );
          await recordAudit({
            actorId: session.client_reference_id,
            action: "stripe.checkout.completed",
            entity: "subscription",
            entityId: subscription.id,
          });
        }
        break;
      }
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const customerId =
          typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
        const userId =
          userIdFromPaymentIntent(intent) ??
          (customerId ? await findUserIdByStripeCustomer(customerId) : null);
        if (userId && customerId) {
          await grantLifetimeAccess(userId, customerId, intent.id);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    logError("Stripe webhook handler failed", error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
