"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authErrorMessage } from "@/lib/auth-messages";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm }),
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

      router.push("/login?redefinida=1");
      router.refresh();
    } catch {
      setError("Não foi possível concluir. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Nova senha</span>
        <input
          type="password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <span className="text-xs text-zinc-500">
          Mínimo de {PASSWORD_MIN_LENGTH} caracteres.
        </span>
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Confirmar senha</span>
        <input
          type="password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
      >
        {loading ? "Salvando..." : "Redefinir senha"}
      </button>
    </form>
  );
}
