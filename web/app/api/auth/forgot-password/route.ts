import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAudit, requestIp } from "@/lib/audit";
import { FORGOT_PASSWORD_SENT_MESSAGE } from "@/lib/auth-messages";
import { authCallbackUrl } from "@/lib/email-confirmation";
import { logError } from "@/lib/logger";
import {
  PASSWORD_RECOVERY_NONCE_COOKIE,
  isWellFormedEmail,
  passwordRecoveryCookieOptions,
} from "@/lib/password-recovery";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { publicSiteOrigin } from "@/lib/site-url";
import {
  recoveryMailConfigured,
  sendRecoveryMail,
} from "@/lib/password-recovery-mail";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isTrustedAuthOrigin } from "@/lib/trusted-origin";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(
    request,
    "auth-forgot-password",
    RATE_LIMITS.authMail,
  );
  if (limited) return limited;

  if (!isTrustedAuthOrigin(request)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!isWellFormedEmail(email)) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  const emailLimited = await enforceRateLimit(
    request,
    "auth-forgot-password",
    RATE_LIMITS.authMailSlow,
    email,
  );
  if (emailLimited) return emailLimited;

  const nonce = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(
    PASSWORD_RECOVERY_NONCE_COOKIE,
    nonce,
    passwordRecoveryCookieOptions(),
  );

  const origin = publicSiteOrigin(request);

  if (recoveryMailConfigured()) {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
          options: { redirectTo: authCallbackUrl(origin, "recovery") },
    });

    if (!error && data?.properties?.email_otp && data.properties.action_link) {
      const sent = await sendRecoveryMail({
        to: email,
        otp: data.properties.email_otp,
        actionLink: data.properties.action_link,
      });
      if (!sent.ok) {
        logError("Falha ao enviar e-mail de recuperação via Resend", sent.reason);
      }
    } else if (error) {
      // Não revela se o e-mail existe ou não.
      logError("generateLink recovery falhou", error);
    }
  } else {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authCallbackUrl(origin, "recovery"),
    });
    if (error) {
      logError("Falha ao enviar e-mail de recuperação (Supabase SMTP)", error);
    }
  }

  await recordAudit({
    action: "password.reset.requested",
    entity: "user",
    ip: requestIp(request),
  });

  return NextResponse.json({ ok: true, message: FORGOT_PASSWORD_SENT_MESSAGE });
}
