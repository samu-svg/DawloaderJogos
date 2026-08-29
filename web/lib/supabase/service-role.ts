import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Só no servidor (webhooks Stripe, tokens do desktop). Não importe no browser. */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não está definida.");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
