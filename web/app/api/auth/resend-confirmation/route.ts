import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import { authCallbackUrl } from "@/lib/email-confirmation";
import { resendConfirmationOtp } from "@/lib/email-confirmation-send";
import { CONFIRM_EMAIL_SENT_MESSAGE } from "@/lib/auth-messages";
import { isWellFormedEmail } from "@/lib/password-recovery";
import { authMailConfigured } from "@/lib/password-recovery-mail";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { publicSiteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { isTrustedAuthOrigin } from "@/lib/trusted-origin";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(
    request,
    "auth-resend-confirmation",
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
    "auth-resend-confirmation",
    RATE_LIMITS.authMailSlow,
    email,
  );
  if (emailLimited) return emailLimited;

  const origin = publicSiteOrigin(request);

  if (authMailConfigured()) {
    await resendConfirmationOtp({ email, origin });
  } else {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: authCallbackUrl(origin, "confirm") },
    });
    if (error) logError("Falha ao reenviar confirmação (SMTP)", error);
  }

  return NextResponse.json({ ok: true, message: CONFIRM_EMAIL_SENT_MESSAGE });
}
