import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import {
  isWellFormedEmail,
  isWellFormedRecoveryOtp,
  normalizeRecoveryOtp,
} from "@/lib/password-recovery";
import { lockRecoverySession } from "@/lib/password-recovery-session";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isTrustedAuthOrigin } from "@/lib/trusted-origin";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(
    request,
    "auth-verify-recovery",
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
    "auth-verify-recovery",
    RATE_LIMITS.authMailSlow,
    email,
  );
  if (emailLimited) return emailLimited;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "recovery",
  });
  if (error || !data.user) {
    if (error) logError("Falha ao validar código de recuperação", error);
    return NextResponse.json(
      { error: "Código inválido ou expirado. Peça outro e-mail." },
      { status: 401 },
    );
  }

  const locked = await lockRecoverySession(data.user.id, request);
  if (locked.error) {
    logError("Falha ao marcar recuperação de senha", locked.error);
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Não foi possível concluir. Tente novamente em instantes." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
