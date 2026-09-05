import { NextResponse } from "next/server";
import { authErrorMessage, isEmailNotConfirmedMessage } from "@/lib/auth-messages";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isTrustedAuthOrigin } from "@/lib/trusted-origin";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "auth-login", RATE_LIMITS.auth);
  if (limited) return limited;

  if (!isTrustedAuthOrigin(request)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
  }

  const emailLimited = await enforceRateLimit(
    request,
    "auth-login",
    RATE_LIMITS.authSlow,
    email,
  );
  if (emailLimited) return emailLimited;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json(
      {
        error: authErrorMessage(error.message),
        code: isEmailNotConfirmedMessage(error.message)
          ? "email_not_confirmed"
          : undefined,
      },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
