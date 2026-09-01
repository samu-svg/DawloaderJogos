"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authErrorMessage } from "@/lib/auth-messages";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

export function PasswordChangeForm({ expired }: { expired: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const payload = (await response.json()) as { error?: string };

    if (response.status === 429) {
      setLoading(false);
      setError("Muitas tentativas. Aguarde um instante.");
      return;
    }

    if (!response.ok) {
      setLoading(false);
      setError(authErrorMessage(payload.error ?? ""));
      return;
    }

    setLoading(false);
    setMessage("Senha atualizada.");
    setPassword("");
    setConfirm("");
    router.refresh();
    if (expired) router.push("/baixar");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {expired ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Sua senha expirou (política de 90 dias). Defina uma nova senha para
          continuar.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
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
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {loading ? "Salvando..." : "Atualizar senha"}
      </button>
    </form>
  );
}
