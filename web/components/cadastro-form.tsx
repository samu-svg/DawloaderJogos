"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authErrorMessage, SIGNUP_CONFIRM_MESSAGE } from "@/lib/auth-messages";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { createClient } from "@/lib/supabase/client";

export function CadastroForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    setLoading(true);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (authError) {
      setError(authErrorMessage(authError.message));
      return;
    }

    if (data.session) {
      router.push("/baixar");
      router.refresh();
      return;
    }

    setMessage(SIGNUP_CONFIRM_MESSAGE);
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
        <span className="text-sm font-medium">Nome</span>
        <input
          type="text"
          required
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </label>
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
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Senha</span>
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
          Mínimo de {PASSWORD_MIN_LENGTH} caracteres. Troque a cada 90 dias em Conta.
        </span>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
      >
        {loading ? "Criando..." : "Criar conta"}
      </button>
      <p className="text-center text-sm text-zinc-500">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          Entrar
        </Link>
      </p>
    </form>
  );
}
