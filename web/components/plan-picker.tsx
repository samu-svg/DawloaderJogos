"use client";

import { useState } from "react";
import { formatCpfCnpj, isValidCpfCnpj } from "@/lib/cpf-cnpj";
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

async function startCheckout(
  plan: PlanId,
  endpoint: "/api/stripe/checkout" | "/api/asaas/checkout",
  extra?: { cpfCnpj?: string },
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, ...extra }),
  });
  const data = await readCheckoutResponse(response);

  if (!response.ok || !data.url) {
    throw new Error(data.error ?? "Não foi possível iniciar o pagamento.");
  }

  window.location.href = data.url;
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
  const [cpfCnpj, setCpfCnpj] = useState("");
  const pixEnabled = pixPlans.length > 0;

  async function handleCheckout(plan: PlanId, method: "card" | "pix") {
    const key = `${plan}-${method}`;
    setLoadingKey(key);
    setError(null);

    try {
      if (method === "pix") {
        if (!isValidCpfCnpj(cpfCnpj)) {
          throw new Error("Informe um CPF ou CNPJ válido para pagar com PIX.");
        }
        await startCheckout(plan, "/api/asaas/checkout", { cpfCnpj });
        return;
      }

      await startCheckout(plan, "/api/stripe/checkout");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao abrir checkout.",
      );
      setLoadingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      {pixEnabled && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-300">
            CPF ou CNPJ para o PIX
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={cpfCnpj}
            onChange={(event) => setCpfCnpj(formatCpfCnpj(event.target.value))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </label>
      )}

      {STRIPE_PLANS.map((plan) => {
        const cardEnabled = cardPlans.includes(plan.id);
        const pixForPlan = pixPlans.includes(plan.id);

        if (!cardEnabled && !pixForPlan) return null;

        return (
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

            <div
              className={`mt-4 grid gap-2 ${cardEnabled && pixForPlan ? "sm:grid-cols-2" : ""}`}
            >
              {cardEnabled && (
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
              )}
              {pixForPlan && (
                <button
                  type="button"
                  disabled={loadingKey !== null}
                  onClick={() => void handleCheckout(plan.id, "pix")}
                  className="rounded-xl border border-teal-400/40 bg-teal-500/10 px-4 py-3 text-sm font-semibold text-teal-100 transition hover:border-teal-300/70 hover:bg-teal-500/20 hover:text-white disabled:opacity-60"
                >
                  {loadingKey === `${plan.id}-pix`
                    ? "Gerando PIX..."
                    : `PIX · ${plan.title} à vista`}
                </button>
              )}
            </div>
          </article>
        );
      })}

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
