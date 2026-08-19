import type Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function upsertSubscriptionFromStripe(
  userId: string,
  customerId: string,
  subscription: Stripe.Subscription,
) {
  const supabase = createServiceRoleClient();
  const periodEndSeconds =
    subscription.items.data[0]?.current_period_end ??
    (subscription as Stripe.Subscription & { current_period_end?: number })
      .current_period_end;

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_end: periodEndSeconds
        ? new Date(periodEndSeconds * 1000).toISOString()
        : null,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Falha ao salvar assinatura: ${error.message}`);
  }
}

export async function findUserIdByStripeCustomer(
  customerId: string,
): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return data?.user_id ?? null;
}
