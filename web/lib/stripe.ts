import Stripe from "stripe";
import { lowestPlanPriceLabel, stripePlansConfigured } from "@/lib/stripe-plans";

let stripeClient: Stripe | null = null;

export function stripeConfigured(): boolean {
  return stripePlansConfigured();
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

/** @deprecated Use lowestPlanPriceLabel() ou STRIPE_PLANS */
export function stripePlanLabel(): string {
  const raw = process.env.STRIPE_PLAN_LABEL?.trim();
  if (raw) return raw.includes("/") ? raw : `${raw}/mês`;
  return `${lowestPlanPriceLabel()}/mês`;
}

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
]);
