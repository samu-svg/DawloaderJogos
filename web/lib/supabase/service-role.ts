import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} não está definida.`);
  }
  return value;
}

/** Cliente com service role — só para webhooks Stripe no servidor. */
export function createServiceRoleClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não está definida.");
  }

  return createSupabaseClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
