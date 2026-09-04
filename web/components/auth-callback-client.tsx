"use client";

import { useEffect } from "react";
import { parseAuthCallbackHash } from "@/lib/password-recovery";
import { createClient } from "@/lib/supabase/client";

export function AuthCallbackClient() {
  useEffect(() => {
    const { type, accessToken, refreshToken } = parseAuthCallbackHash(
      window.location.hash,
    );

    async function finish() {
      if (!accessToken || !refreshToken) {
        window.location.replace("/esqueci-senha?expirado=1");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        window.location.replace("/esqueci-senha?expirado=1");
        return;
      }

      if (type === "recovery") {
        const lock = await fetch("/api/auth/recovery-lock", { method: "POST" });
        if (!lock.ok) {
          window.location.replace("/esqueci-senha?erro=1");
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
