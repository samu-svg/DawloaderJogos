import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAudit, requestIp } from "@/lib/audit";
import { logError } from "@/lib/logger";
import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_NONCE_COOKIE,
  PASSWORD_RECOVERY_PATH,
  clearPasswordRecoveryCookieOptions,
  isPasswordRecoveryCallback,
  passwordRecoveryCookieOptions,
} from "@/lib/password-recovery";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { safeInternalPath } from "@/lib/safe-redirect";
import { publicSiteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, "auth-callback", RATE_LIMITS.auth);
  if (limited) return limited;

  const site = publicSiteOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"), "/baixar");

  const cookieStore = await cookies();
  const nonce = cookieStore.get(PASSWORD_RECOVERY_NONCE_COOKIE)?.value ?? null;
  const recovery = isPasswordRecoveryCallback({
    type: searchParams.get("type"),
    nonce,
  });

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      if (recovery) {
        const { error: lockError } = await createServiceRoleClient()
          .from("profiles")
          .update({ password_reset_required: true })
          .eq("id", data.user.id);

        cookieStore.set(
          PASSWORD_RECOVERY_NONCE_COOKIE,
          "",
          clearPasswordRecoveryCookieOptions(),
        );

        if (lockError) {
          logError("Falha ao marcar recuperação de senha", lockError);
          await supabase.auth.signOut();
          return NextResponse.redirect(`${site}/esqueci-senha?erro=1`);
        }

        cookieStore.set(
          PASSWORD_RECOVERY_COOKIE,
          "1",
          passwordRecoveryCookieOptions(),
        );

        await recordAudit({
          actorId: data.user.id,
          action: "password.reset.started",
          entity: "user",
          entityId: data.user.id,
          ip: requestIp(request),
        });

        const redirect = NextResponse.redirect(`${site}${PASSWORD_RECOVERY_PATH}`);
        redirect.cookies.set(
          PASSWORD_RECOVERY_COOKIE,
          "1",
          passwordRecoveryCookieOptions(),
        );
        redirect.cookies.set(
          PASSWORD_RECOVERY_NONCE_COOKIE,
          "",
          clearPasswordRecoveryCookieOptions(),
        );
        return redirect;
      }

      return NextResponse.redirect(`${site}${next}`);
    }
  }

  return NextResponse.redirect(`${site}/login`);
}
