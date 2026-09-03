"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  cancelAtPeriodEnd: boolean;
  periodEndLabel: string | null;
};

type CancelResponse = { cancelAtPeriodEnd?: boolean; error?: string };

export function CancelSubscriptionControls({
  cancelAtPeriodEnd,
  periodEndLabel,
}: Props) {
  const router = useRouter();
  const [scheduled, setScheduled] = useState(cancelAtPeriodEnd);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "cancel" | "resume") {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as CancelResponse;

      if (!response.ok) {
        setError(data.error ?? "Não foi possível concluir. Tente de novo.");
        return;
      }

      setScheduled(data.cancelAtPeriodEnd === true);
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Sem conexão com o servidor. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  if (scheduled) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3.5">
          <p className="text-sm font-medium text-amber-200">
            Renovação cancelada
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-200/70">
            {periodEndLabel
              ? `Seu acesso continua até ${periodEndLabel} e não haverá nova cobrança.`
              : "Não haverá nova cobrança. Seu acesso continua até o fim do período já pago."}
          </p>
        </div>

        {error && (
          <p className="text-xs leading-5 text-red-300" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void send("resume")}
          disabled={loading}
          className="w-full rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? "Reativando..." : "Voltar a renovar"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-xs leading-5 text-red-300" role="alert">
          {error}
        </p>
      )}

      {confirming ? (
        <div className="space-y-4 rounded-2xl border border-border bg-black/20 px-4 py-4">
          <p className="text-sm leading-6 text-zinc-300">
            Você não perde o que já pagou.{" "}
            {periodEndLabel
              ? `O acesso segue até ${periodEndLabel} e depois disso não cobramos de novo.`
              : "O acesso segue até o fim do período já pago e depois disso não cobramos de novo."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void send("cancel")}
              disabled={loading}
              className="flex-1 rounded-xl border border-red-400/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
            >
              {loading ? "Cancelando..." : "Confirmar cancelamento"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={loading}
              className="flex-1 rounded-xl border border-border px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white disabled:opacity-60"
            >
              Manter meu plano
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full rounded-2xl border border-border px-6 py-3 text-sm text-zinc-300 transition hover:border-red-400/40 hover:text-red-200"
        >
          Cancelar renovação
        </button>
      )}
    </div>
  );
}
