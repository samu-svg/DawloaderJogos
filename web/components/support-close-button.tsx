"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SupportCloseButton({
  ticketId,
  closed,
}: {
  ticketId: string;
  closed: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (closed) return null;

  async function handleClose() {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/support/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setLoading(false);
      setError(payload.error ?? "Não foi possível fechar.");
      return;
    }
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : null}
      <button
        type="button"
        onClick={handleClose}
        disabled={loading}
        className="rounded-lg border border-border px-3 py-1.5 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white disabled:opacity-60"
      >
        {loading ? "Fechando…" : "Fechar ticket"}
      </button>
    </div>
  );
}
