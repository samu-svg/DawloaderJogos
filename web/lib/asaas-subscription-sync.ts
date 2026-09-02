import { createServiceRoleClient } from "@/lib/supabase/service-role";

function asaasCustomerRef(asaasCustomerId: string): string {
  return `asaas:${asaasCustomerId}`;
}

export async function upsertPrepaidAccessFromAsaasPayment(
  userId: string,
  asaasCustomerId: string,
  months: number,
  asaasPaymentId: string,
) {
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + months);

  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.stripe_subscription_id === asaasPaymentId) {
    return false;
  }

  const customerRef =
    existing?.stripe_customer_id?.startsWith("cus_")
      ? existing.stripe_customer_id
      : asaasCustomerRef(asaasCustomerId);

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerRef,
      stripe_subscription_id: asaasPaymentId,
      status: "active",
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);
  return true;
}
