"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SUPPORT_BODY_MAX,
  SUPPORT_SUBJECT_MAX,
  SUPPORT_SUBJECT_MIN,
} from "@/lib/support";

export function NewSupportTicketForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    const payload = (await response.json()) as { error?: string; id?: string };

    if (!response.ok) {
      setLoading(false);
      setError(payload.error ?? "Não foi possível abrir o ticket.");
      return;
    }

    if (payload.id) {
      router.push(`/suporte/${payload.id}`);
      router.refresh();
      return;
    }

    setLoading(false);
    setError("Resposta inesperada do servidor.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-zinc-300">Assunto</span>
        <input
          type="text"
          required
          minLength={SUPPORT_SUBJECT_MIN}
          maxLength={SUPPORT_SUBJECT_MAX}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          placeholder="Ex.: Erro ao instalar jogo"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-zinc-300">Mensagem</span>
        <textarea
          required
          maxLength={SUPPORT_BODY_MAX}
          rows={5}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          placeholder="Descreva o problema com o máximo de detalhes útil."
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {loading ? "Enviando…" : "Abrir ticket"}
      </button>
    </form>
  );
}
