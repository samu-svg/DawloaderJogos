"use client";

import Link from "next/link";
import { useState } from "react";
import {
  authErrorMessage,
  FORGOT_PASSWORD_SENT_MESSAGE,
} from "@/lib/auth-messages";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (response.status === 429) {
        setError("Muitas tentativas. Aguarde um instante.");
        return;
      }

      if (!response.ok) {
        setError(authErrorMessage(payload.error ?? ""));
        return;
      }

      setMessage(payload.message ?? FORGOT_PASSWORD_SENT_MESSAGE);
    } catch {
      setError("Não foi possível concluir. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {message}
        </p>
      )}
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">E-mail</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </label>
      <button
        type="submit"
        disabled={loading || Boolean(message)}
        className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
      >
        {loading ? "Enviando..." : "Enviar link"}
      </button>
      <p className="text-center text-sm text-zinc-500">
        Lembrou a senha?{" "}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          Entrar
        </Link>
      </p>
    </form>
  );
}
