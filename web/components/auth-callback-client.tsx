"use client";

import { useEffect } from "react";
import {
  authCallbackFailurePath,
  resolveAuthCallbackKind,
} from "@/lib/email-confirmation";
import { parseAuthCallbackHash } from "@/lib/password-recovery";
import { createClient } from "@/lib/supabase/client";

export function AuthCallbackClient() {
  useEffect(() => {
    const { type, accessToken, refreshToken } = parseAuthCallbackHash(
      window.location.hash,
    );
    const intent = new URLSearchParams(window.location.search).get("intent");
    const kind = resolveAuthCallbackKind({ type, intent, nonce: null });
    const failExpired = authCallbackFailurePath(kind, "expirado");
    const failError = authCallbackFailurePath(kind, "erro");

    async function finish() {
      if (!accessToken || !refreshToken) {
        window.location.replace(failExpired);
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        window.location.replace(failExpired);
        return;
      }

      if (kind === "recovery" || type === "recovery") {
        const lock = await fetch("/api/auth/recovery-lock", { method: "POST" });
        if (!lock.ok) {
          window.location.replace(failError);
          return;
        }
        window.location.replace("/redefinir-senha");
        return;
      }

      window.location.replace("/baixar");
    }

    void finish();
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <p className="text-center text-sm text-zinc-500">Abrindo o link seguro…</p>
    </main>
  );
}
