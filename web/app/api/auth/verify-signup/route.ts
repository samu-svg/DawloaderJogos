import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import {
  isWellFormedEmail,
  isWellFormedRecoveryOtp,
  normalizeRecoveryOtp,
} from "@/lib/password-recovery";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isTrustedAuthOrigin } from "@/lib/trusted-origin";

const CONFIRM_OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "email",
  "magiclink",
];

export async function POST(request: Request) {
  const limited = await enforceRateLimit(
    request,
    "auth-verify-signup",
    RATE_LIMITS.authMail,
  );
  if (limited) return limited;

  if (!isTrustedAuthOrigin(request)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  let body: { email?: string; token?: string };
  try {
    body = (await request.json()) as { email?: string; token?: string };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const token = normalizeRecoveryOtp(body.token ?? "");
  if (!isWellFormedEmail(email) || !isWellFormedRecoveryOtp(token)) {
    return NextResponse.json(
      { error: "Informe o e-mail e o código do e-mail." },
      { status: 400 },
    );
  }

  const emailLimited = await enforceRateLimit(
    request,
    "auth-verify-signup",
    RATE_LIMITS.authMailSlow,
    email,
  );
  if (emailLimited) return emailLimited;

  const supabase = await createClient();
  let lastError: unknown = null;

  for (const type of CONFIRM_OTP_TYPES) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });
    if (!error && data.user) {
      return NextResponse.json({ ok: true });
    }
    lastError = error;
  }

  if (lastError) logError("Falha ao validar código de confirmação", lastError);
  return NextResponse.json(
    { error: "Código inválido ou expirado. Peça outro e-mail." },
    { status: 401 },
  );
}
