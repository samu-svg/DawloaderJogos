import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAudit, requestIp } from "@/lib/audit";
import { FORGOT_PASSWORD_SENT_MESSAGE } from "@/lib/auth-messages";
import { logError } from "@/lib/logger";
import {
  PASSWORD_RECOVERY_NONCE_COOKIE,
  PASSWORD_RECOVERY_PATH,
  isWellFormedEmail,
  passwordRecoveryCookieOptions,
} from "@/lib/password-recovery";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { publicSiteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(PASSWORD_RECOVERY_PATH)}`,
  });
  if (error) {
    logError("Falha ao enviar e-mail de recuperação", error);
  }

  await recordAudit({
    action: "password.reset.requested",
    entity: "user",
    ip: requestIp(request),
  });

  return NextResponse.json({ ok: true, message: FORGOT_PASSWORD_SENT_MESSAGE });
}
