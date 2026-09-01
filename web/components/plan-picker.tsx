"use client";

import { useState } from "react";
import type { PaymentMethod, PlanId } from "@/lib/stripe-plans";
import { STRIPE_PLANS } from "@/lib/stripe-plans";

async function startCheckout(plan: PlanId, method: PaymentMethod) {
  const response = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, method }),
  });
  const data = (await response.json()) as { url?: string; error?: string };

  if (!response.ok || !data.url) {
    throw new Error(data.error ?? "Não foi possível iniciar o pagamento.");
  }

  window.location.href = data.url;
}

export function PlanPicker() {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(plan: PlanId, method: PaymentMethod) {
    const key = `${plan}-${method}`;
    setLoadingKey(key);
    setError(null);

    try {
      await startCheckout(plan, method);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao abrir checkout.",
      );
      setLoadingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      {STRIPE_PLANS.map((plan) => (
        <article
          key={plan.id}
          className="rounded-2xl border border-border/80 bg-surface/60 p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-white">{plan.title}</p>
              <p className="mt-1 text-2xl font-bold text-white">{plan.priceLabel}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={loadingKey !== null}
              onClick={() => void handleCheckout(plan.id, "card")}
              className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
            >
              {loadingKey === `${plan.id}-card`
                ? "Redirecionando..."
                : `Cartão · ${plan.cardCadence}`}
            </button>
            <button
              type="button"
              disabled={loadingKey !== null}
              onClick={() => void handleCheckout(plan.id, "pix")}
              className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:opacity-60"
            >
              {loadingKey === `${plan.id}-pix`
                ? "Redirecionando..."
                : `PIX · ${plan.title} à vista`}
            </button>
          </div>
        </article>
      ))}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <p className="text-xs leading-5 text-zinc-500">
        Cartão renova automaticamente no fim de cada período. PIX libera o acesso
        pelo tempo do plano, sem renovação automática.
      </p>
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
      await startCheckout("1m", "card");
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
