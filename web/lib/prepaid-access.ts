import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getPlan, type PlanId } from "@/lib/stripe-plans";

/**
 * Razão de créditos pré-pagos (tabela public.payment_grants).
 *
 * Toda concessão de acesso passa por aqui. A unicidade de (provider,
 * payment_id) no banco é o que impede o mesmo pagamento de creditar duas
 * vezes — inclusive quando o webhook reenvia ou quando o usuário reabre uma
 * página antiga de checkout PIX já pago.
 */

export type PaymentProvider = "asaas" | "stripe";

export type GrantResult = {
  /** Vencimento do acesso após a operação, ou null se não há acesso. */
  periodEnd: string | null;
  /** false quando o pagamento já estava creditado. */
  created: boolean;
};

export type RevokeResult = {
  periodEnd: string | null;
  revoked: boolean;
};

export function asaasCustomerRef(customerId: string | null | undefined): string | null {
  const id = customerId?.trim();
  return id ? `asaas:${id}` : null;
}

export async function grantPrepaidAccess(input: {
  userId: string;
  provider: PaymentProvider;
  paymentId: string;
  planId: PlanId;
  amountCents: number;
  customerRef: string | null;
}): Promise<GrantResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("grant_prepaid_access", {
      p_user_id: input.userId,
      p_provider: input.provider,
      p_payment_id: input.paymentId,
      p_plan_id: input.planId,
      p_months: getPlan(input.planId).months,
      p_amount_cents: input.amountCents,
      p_customer_ref: input.customerRef,
    })
    .single<{ new_period_end: string | null; was_created: boolean }>();

  if (error) throw new Error(error.message);
  return { periodEnd: data?.new_period_end ?? null, created: data?.was_created ?? false };
}

export async function revokePrepaidAccess(input: {
  provider: PaymentProvider;
  paymentId: string;
  reason: string;
}): Promise<RevokeResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("revoke_prepaid_access", {
      p_provider: input.provider,
      p_payment_id: input.paymentId,
      p_reason: input.reason,
    })
    .single<{ new_period_end: string | null; was_revoked: boolean }>();

  if (error) throw new Error(error.message);
  return { periodEnd: data?.new_period_end ?? null, revoked: data?.was_revoked ?? false };
}
