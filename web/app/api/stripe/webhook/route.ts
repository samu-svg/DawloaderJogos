import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, subscriptionsEnabled } from "@/lib/stripe";
import {
  findUserIdByStripeCustomer,
  upsertSubscriptionFromStripe,
} from "@/lib/stripe-subscription-sync";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId =
    subscription.metadata.supabase_user_id ??
    (await findUserIdByStripeCustomer(subscription.customer as string));

  if (!userId) return;

  await upsertSubscriptionFromStripe(
    userId,
    subscription.customer as string,
    subscription,
  );
}

export async function POST(request: Request) {
  if (!subscriptionsEnabled()) {
    return NextResponse.json({ error: "Assinaturas desativadas." }, { status: 503 });
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
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
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
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
        break;
      }
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook handler failed:", error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
