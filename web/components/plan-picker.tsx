"use client";

import Link from "next/link";
import { useState } from "react";
import { pixPlanPath } from "@/lib/asaas-pix-format";
import type { PlanId } from "@/lib/stripe-plans";
import { STRIPE_PLANS } from "@/lib/stripe-plans";

async function readCheckoutResponse(response: Response): Promise<{ url?: string; error?: string }> {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as { url?: string; error?: string };
  } catch {
    return { error: "Resposta inválida do servidor. Tente de novo em instantes." };
  }
}

async function startCheckout(plan: PlanId, endpoint: "/api/stripe/checkout") {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const data = await readCheckoutResponse(response);

  if (!response.ok || !data.url) {
    throw new Error(data.error ?? "Não foi possível iniciar o pagamento.");
  }

  window.location.href = data.url;
}

function priceValue(priceLabel: string): number {
  const normalized = priceLabel.replace(/[^\d,]/g, "").replace(",", ".");
  return Number.parseFloat(normalized);
}

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PlanPicker({
  cardPlans,
  pixPlans,
}: {
  cardPlans: PlanId[];
  pixPlans: PlanId[];
}) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const monthlyBase = priceValue(STRIPE_PLANS[0].priceLabel);

  async function handleCardCheckout(plan: PlanId) {
    const key = `${plan}-card`;
    setLoadingKey(key);
    setError(null);

    try {
      await startCheckout(plan, "/api/stripe/checkout");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao abrir checkout.",
      );
      setLoadingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 pt-3 lg:grid-cols-3">
        {STRIPE_PLANS.map((plan) => {
          const cardEnabled = cardPlans.includes(plan.id);
          const pixForPlan = pixPlans.includes(plan.id);
          if (!cardEnabled && !pixForPlan) return null;

          const total = priceValue(plan.priceLabel);
          const monthly = total / plan.months;
          const saves = plan.months > 1 && monthlyBase * plan.months - total;
          const featured = plan.id === "2m";

          return (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-[28px] border p-6 ${
                featured
                  ? "border-accent/50 bg-gradient-to-b from-violet-600/20 via-surface to-surface shadow-[0_24px_80px_rgba(109,40,217,0.18)]"
                  : "border-border/80 bg-surface/80"
              }`}
            >
              {featured && (
                <p className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-accent/40 bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                  Recomendado
                </p>
              )}

              <p className="text-sm font-semibold text-zinc-300">{plan.title}</p>
              <p className="mt-3 text-4xl font-bold tracking-tight text-white">
                {plan.priceLabel}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {plan.months === 1
                  ? "Acesso por 30 dias"
                  : monthly < monthlyBase
                    ? `${formatBrl(monthly)}/mês · ${plan.months} meses`
                    : `${plan.months} meses de acesso`}
              </p>
              {saves && saves > 0.5 ? (
                <p className="mt-2 text-xs font-medium text-teal-300">
                  Economize {formatBrl(saves)} em relação a {plan.months} meses avulsos
                </p>
              ) : (
                <p className="mt-2 text-xs text-zinc-600">
                  PIX à vista ou cartão {plan.cardCadence}
                </p>
              )}

              <div className="mt-6 flex flex-1 flex-col gap-2">
                {pixForPlan && (
                  <Link
                    href={pixPlanPath(plan.id)}
                    className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold transition ${
                      featured
                        ? "bg-teal-500 text-teal-950 shadow-lg shadow-teal-500/20 hover:bg-teal-400"
                        : "border border-teal-400/40 bg-teal-500/10 text-teal-100 hover:border-teal-300/70 hover:bg-teal-500/20 hover:text-white"
                    }`}
                  >
                    Pagar com PIX
                  </Link>
                )}
                {cardEnabled && (
                  <button
                    type="button"
                    disabled={loadingKey !== null}
                    onClick={() => void handleCardCheckout(plan.id)}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60 ${
                      featured && !pixForPlan
                        ? "bg-accent text-white hover:bg-accent-hover"
                        : "border border-border text-zinc-200 hover:border-zinc-500 hover:text-white"
                    }`}
                  >
                    {loadingKey === `${plan.id}-card`
                      ? "Redirecionando..."
                      : `Cartão · ${plan.cardCadence}`}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <div className="grid gap-3 text-center text-xs leading-5 text-zinc-500 sm:grid-cols-2">
        <p className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3">
          <strong className="font-medium text-zinc-300">Cartão:</strong> renovação
          automática no fim do período. Cancele quando quiser.
        </p>
        <p className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3">
          <strong className="font-medium text-zinc-300">PIX:</strong> pagamento à
          vista, sem renovação. O acesso vale pelo tempo do plano.
        </p>
      </div>
    </div>
  );
}

export function SubscribeCheckoutButton({
  label = "Assinar agora",
}: {
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      await startCheckout("1m", "/api/stripe/checkout");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao abrir checkout.",
      );
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-hover disabled:opacity-60 sm:w-auto"
      >
        {loading ? "Redirecionando..." : label}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
