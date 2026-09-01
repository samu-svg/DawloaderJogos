import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_PRICE_ID?.trim(),
  );
}

export function subscriptionsEnabled(): boolean {
  if (process.env.STRIPE_SUBSCRIPTIONS_ENABLED === "false") return false;
  return stripeConfigured();
}

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY não está definida.");
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function stripePriceId(): string {
  const priceId = process.env.STRIPE_PRICE_ID?.trim();
  if (!priceId) throw new Error("STRIPE_PRICE_ID não está definida.");
  return priceId;
}

export function stripePlanLabel(): string {
  const raw = process.env.STRIPE_PLAN_LABEL?.trim() || "R$ 49,90";
  return raw.includes("/") ? raw : `${raw}/mês`;
}

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
]);
