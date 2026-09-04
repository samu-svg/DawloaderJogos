import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} não está definida. Copie .env.example para .env.local e preencha.`,
    );
  }
  return value;
}

/**
 * Client bound to the caller's session. Every query runs under that user's
 * row level security policies, so authorization lives in the database rather
 * than being re-implemented in each route.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies; the middleware refreshes
            // the session instead.
          }
        },
      },
    },
  );
}

/**
 * Server-only reader for páginas públicas e manifesto. Usa a service role quando
 * disponível para não depender de SELECT anônimo na tabela entries (links de
 * download). Sempre filtre is_public nas queries — a service role ignora RLS.
 */
export async function createPublicReaderClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não está definida. Sem ela o catálogo público não lê entries.",
    );
  }
  return createSupabaseClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Returns the signed-in user, or null. */
export async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
