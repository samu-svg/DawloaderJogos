"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authErrorMessage } from "@/lib/auth-messages";
import { safeInternalPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeInternalPath(searchParams.get("next"), "/baixar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authErrorMessage(authError.message));
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
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
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Senha</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
      <p className="text-center text-sm text-zinc-500">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-accent hover:text-accent-hover">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
