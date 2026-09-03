import type Stripe from "stripe";

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
