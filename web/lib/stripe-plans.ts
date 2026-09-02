export type PlanId = "1m" | "2m" | "3m";
export type PaymentMethod = "card" | "pix";

export type PlanDefinition = {
  id: PlanId;
  months: number;
  title: string;
  priceLabel: string;
  /** Texto curto para cartão recorrente */
  cardCadence: string;
};

export const STRIPE_PLANS: readonly PlanDefinition[] = [
  {
    id: "1m",
    months: 1,
    title: "1 mês",
    priceLabel: "R$ 49,90",
    cardCadence: "por mês",
  },
  {
    id: "2m",
    months: 2,
    title: "2 meses",
    priceLabel: "R$ 89,90",
    cardCadence: "a cada 2 meses",
  },
  {
    id: "3m",
    months: 3,
    title: "3 meses",
    priceLabel: "R$ 159,90",
    cardCadence: "a cada 3 meses",
  },
] as const;

const PRICE_ENV_KEYS: Record<
  PlanId,
  Record<PaymentMethod, string>
> = {
  "1m": {
    card: "STRIPE_PRICE_1M_SUB",
    pix: "STRIPE_PRICE_1M_PIX",
  },
  "2m": {
    card: "STRIPE_PRICE_2M_SUB",
    pix: "STRIPE_PRICE_2M_PIX",
  },
  "3m": {
    card: "STRIPE_PRICE_3M_SUB",
    pix: "STRIPE_PRICE_3M_PIX",
  },
};

export function isPlanId(value: string): value is PlanId {
  return value === "1m" || value === "2m" || value === "3m";
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return value === "card" || value === "pix";
}

export function getPlan(planId: PlanId): PlanDefinition {
  const plan = STRIPE_PLANS.find((item) => item.id === planId);
  if (!plan) throw new Error(`Plano desconhecido: ${planId}`);
  return plan;
}

export function stripePriceIdFor(planId: PlanId, method: PaymentMethod): string | null {
  const envKey = PRICE_ENV_KEYS[planId][method];
  const priceId = process.env[envKey]?.trim();
  if (priceId) return priceId;

  // Compatibilidade: STRIPE_PRICE_ID antigo = assinatura de 1 mês no cartão
  if (planId === "1m" && method === "card") {
    return process.env.STRIPE_PRICE_ID?.trim() || null;
  }

  return null;
}

export function stripePlansConfigured(): boolean {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return false;
  return STRIPE_PLANS.some((plan) => stripePriceIdFor(plan.id, "card"));
}

export function lowestPlanPriceLabel(): string {
  return `a partir de ${STRIPE_PLANS[0].priceLabel}`;
}

export function accessMonthsFromMetadata(
  metadata: Record<string, string> | null | undefined,
): number | null {
  if (!metadata) return null;

  const rawMonths = metadata.access_months?.trim();
  if (rawMonths) {
    const months = Number.parseInt(rawMonths, 10);
    if (Number.isFinite(months) && months > 0) return months;
  }

  const planId = metadata.plan?.trim();
  if (planId && isPlanId(planId)) {
    return getPlan(planId).months;
  }

  return null;
}
