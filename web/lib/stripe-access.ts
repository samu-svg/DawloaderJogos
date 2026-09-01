import type Stripe from "stripe";

export function checkoutSessionGrantsPrepaidAccess(
  session: Pick<Stripe.Checkout.Session, "mode" | "payment_status">,
): boolean {
  return session.mode === "payment" && session.payment_status === "paid";
}

/** @deprecated Use checkoutSessionGrantsPrepaidAccess */
export function checkoutSessionGrantsLifetimeAccess(
  session: Pick<Stripe.Checkout.Session, "mode" | "payment_status">,
): boolean {
  return checkoutSessionGrantsPrepaidAccess(session);
}

export function userIdFromCheckoutSession(
  session: Pick<Stripe.Checkout.Session, "client_reference_id" | "metadata">,
): string | null {
  return (
    session.client_reference_id ??
    session.metadata?.app_user_id ??
    session.metadata?.supabase_user_id ??
    null
  );
}

export function userIdFromPaymentIntent(
  intent: Pick<Stripe.PaymentIntent, "metadata">,
): string | null {
  return intent.metadata?.app_user_id ?? intent.metadata?.supabase_user_id ?? null;
}
