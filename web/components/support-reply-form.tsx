"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SUPPORT_BODY_MAX } from "@/lib/support";

export function SupportReplyForm({
  ticketId,
  closed,
}: {
  ticketId: string;
  closed: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (closed) {
    return (
      <p className="text-sm text-zinc-500">
        Este ticket está fechado. Abra um novo em{" "}
        <Link href="/suporte" className="text-zinc-300 underline hover:text-white">
          Suporte
        </Link>{" "}
        se ainda precisar de ajuda.
      </p>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch(`/api/support/tickets/${ticketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setLoading(false);
      setError(payload.error ?? "Não foi possível enviar.");
      return;
    }

    setBody("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error ? (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-zinc-300">Sua resposta</span>
        <textarea
          required
          maxLength={SUPPORT_BODY_MAX}
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {loading ? "Enviando…" : "Enviar"}
      </button>
    </form>
  );
}
