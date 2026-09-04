"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_NONCE_COOKIE,
  clearPasswordRecoveryCookieOptions,
} from "@/lib/password-recovery";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.set(
    PASSWORD_RECOVERY_COOKIE,
    "",
    clearPasswordRecoveryCookieOptions(),
  );
  cookieStore.set(
    PASSWORD_RECOVERY_NONCE_COOKIE,
    "",
    clearPasswordRecoveryCookieOptions(),
  );
  redirect("/login");
}
