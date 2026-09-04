"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  authErrorMessage,
  FORGOT_PASSWORD_SENT_MESSAGE,
} from "@/lib/auth-messages";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function sendEmail(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSending(true);

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

      setSent(true);
      setMessage(payload.message ?? FORGOT_PASSWORD_SENT_MESSAGE);
    } catch {
      setError("Não foi possível concluir. Tente novamente em instantes.");
    } finally {
      setSending(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setVerifying(true);

    try {
      const response = await fetch("/api/auth/verify-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });
      const payload = (await response.json()) as { error?: string };

      if (response.status === 429) {
        setError("Muitas tentativas. Aguarde um instante.");
        return;
      }

      if (!response.ok) {
        setError(authErrorMessage(payload.error ?? ""));
        return;
      }

      router.push("/redefinir-senha");
      router.refresh();
    } catch {
      setError("Não foi possível concluir. Tente novamente em instantes.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={sendEmail} className="space-y-4">
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
          disabled={sending || verifying}
          className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
        >
          {sending ? "Enviando..." : sent ? "Reenviar e-mail" : "Enviar código"}
        </button>
      </form>

      {sent ? (
        <form onSubmit={verifyCode} className="space-y-4 border-t border-border pt-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Código do e-mail</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={12}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 tracking-[0.3em] text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <span className="text-xs text-zinc-500">
              O e-mail às vezes traz só o código, sem botão. Cole aqui.
            </span>
          </label>
          <button
            type="submit"
            disabled={verifying || sending}
            className="w-full rounded-lg border border-accent py-2.5 font-medium text-white transition hover:bg-accent/20 disabled:opacity-60"
          >
            {verifying ? "Verificando..." : "Continuar"}
          </button>
        </form>
      ) : null}

      <p className="text-center text-sm text-zinc-500">
        Lembrou a senha?{" "}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          Entrar
        </Link>
      </p>
    </div>
  );
}
