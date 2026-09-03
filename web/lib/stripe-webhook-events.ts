/**
 * Regras puras do webhook do Stripe. Sem I/O e sem env, para os testes
 * cobrirem o caminho do dinheiro do cartão sem subir nada.
 */

export type StripeEventAction =
  | "checkout"
  | "subscription"
  | "refund"
  | "dispute"
  | "payment_failed"
  | "ignore";

const EVENT_ACTIONS: Record<string, StripeEventAction> = {
  "checkout.session.completed": "checkout",
  "checkout.session.async_payment_succeeded": "checkout",
  "customer.subscription.created": "subscription",
  "customer.subscription.updated": "subscription",
  "customer.subscription.deleted": "subscription",
  "customer.subscription.paused": "subscription",
  "customer.subscription.resumed": "subscription",
  "charge.refunded": "refund",
  "charge.dispute.created": "dispute",
  "invoice.payment_failed": "payment_failed",
};

export function stripeEventAction(type: string): StripeEventAction {
  return EVENT_ACTIONS[type.trim()] ?? "ignore";
}

/** Statuses do Stripe que liberam o acesso. */
const ACTIVE_CARD_STATUSES = new Set(["active", "trialing"]);

export function cardStatusIsActive(status: string): boolean {
  return ACTIVE_CARD_STATUSES.has(status.trim());
}

type PeriodSource = {
  items?: { data?: ReadonlyArray<{ current_period_end?: number | null }> };
  current_period_end?: number | null;
};

/**
 * O fim do período vigente saiu da assinatura e passou para os itens em
 * versões recentes da API, então os dois lugares são consultados. Com mais de
 * um item vale o maior: é até quando o dinheiro já pago cobre.
 */
export function subscriptionPeriodEndSeconds(
  subscription: PeriodSource,
): number | null {
  const fromItems = (subscription.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value) && value > 0,
    );

  if (fromItems.length > 0) return Math.max(...fromItems);

  const fromRoot = subscription.current_period_end;
  if (typeof fromRoot === "number" && Number.isFinite(fromRoot) && fromRoot > 0) {
    return fromRoot;
  }

  return null;
}

export function periodEndToIso(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

type PriceSource = {
  items?: {
    data?: ReadonlyArray<{ price?: { id?: string | null } | null }>;
  };
};

export function subscriptionPriceIds(subscription: PriceSource): string[] {
  return (subscription.items?.data ?? [])
    .map((item) => item.price?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/** Price que não está no catálogo indica config errada no painel do Stripe. */
export function unknownPriceIds(
  priceIds: readonly string[],
  knownIds: readonly string[],
): string[] {
  const known = new Set(knownIds);
  return priceIds.filter((id) => !known.has(id));
}

export type RefundKind = "none" | "partial" | "full";

export function chargeRefundKind(charge: {
  amount?: number | null;
  amount_refunded?: number | null;
  refunded?: boolean | null;
}): RefundKind {
  const refunded =
    typeof charge.amount_refunded === "number" && charge.amount_refunded > 0
      ? charge.amount_refunded
      : 0;

  if (refunded === 0) return charge.refunded === true ? "full" : "none";

  const amount = typeof charge.amount === "number" ? charge.amount : 0;
  if (charge.refunded === true || (amount > 0 && refunded >= amount)) {
    return "full";
  }
  return "partial";
}

export function isCardSubscriptionId(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith("sub_"));
}
