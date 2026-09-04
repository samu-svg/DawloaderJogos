import { cookies } from "next/headers";
import { recordAudit, requestIp } from "@/lib/audit";
import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_NONCE_COOKIE,
  clearPasswordRecoveryCookieOptions,
  passwordRecoveryCookieOptions,
} from "@/lib/password-recovery";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function lockRecoverySession(
  userId: string,
  request?: Request,
): Promise<{ error: string | null }> {
  const { error } = await createServiceRoleClient()
    .from("profiles")
    .update({ password_reset_required: true })
    .eq("id", userId);
  if (error) return { error: error.message };

  const cookieStore = await cookies();
  cookieStore.set(
    PASSWORD_RECOVERY_COOKIE,
    "1",
    passwordRecoveryCookieOptions(),
  );
  cookieStore.set(
    PASSWORD_RECOVERY_NONCE_COOKIE,
    "",
    clearPasswordRecoveryCookieOptions(),
  );

  if (request) {
    await recordAudit({
      actorId: userId,
      action: "password.reset.started",
      entity: "user",
      entityId: userId,
      ip: requestIp(request),
    });
  }

  return { error: null };
}
