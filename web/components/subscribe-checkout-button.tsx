"use client";

import { useState } from "react";

export function SubscribeCheckoutButton({
  label = "Assinar agora",
}: {
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Não foi possível iniciar o pagamento.");
      }

      window.location.href = data.url;
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
        onClick={() => void startCheckout()}
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-hover disabled:opacity-60 sm:w-auto"
      >
        {loading ? "Redirecionando..." : label}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    const response = await fetch("/api/stripe/portal", { method: "POST" });
    const data = (await response.json()) as { url?: string };
    if (data.url) window.location.href = data.url;
    else setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={() => void openPortal()}
      disabled={loading}
      className="rounded-xl border border-border px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white disabled:opacity-60"
    >
      {loading ? "Abrindo..." : "Ver recibos"}
    </button>
  );
}
