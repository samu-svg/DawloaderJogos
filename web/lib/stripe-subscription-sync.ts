import type Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function upsertPrepaidAccessFromPayment(
  userId: string,
  customerId: string,
  months: number,
) {
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + months);

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: null,
      status: "active",
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);
}

/** @deprecated PIX pré-pago usa upsertPrepaidAccessFromPayment */
export async function upsertLifetimeAccessFromPayment(
  userId: string,
  customerId: string,
) {
  return upsertPrepaidAccessFromPayment(userId, customerId, 1);
}

export async function upsertSubscriptionFromStripe(
  userId: string,
  customerId: string,
  subscription: Stripe.Subscription,
) {
  const periodEndSeconds =
    subscription.items.data[0]?.current_period_end ??
    (subscription as Stripe.Subscription & { current_period_end?: number })
      .current_period_end;

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_end: periodEndSeconds
        ? new Date(periodEndSeconds * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);
}

export async function findUserIdByStripeCustomer(
  customerId: string,
): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.user_id ?? null;
}
