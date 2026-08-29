import { NextResponse } from "next/server";
import { authErrorMessage } from "@/lib/auth-messages";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isTrustedAuthOrigin } from "@/lib/trusted-origin";

function requestOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "auth-signup", RATE_LIMITS.auth);
  if (limited) return limited;

  if (!isTrustedAuthOrigin(request)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  let body: { email?: string; password?: string; displayName?: string };
  try {
    body = (await request.json()) as {
      email?: string;
      password?: string;
      displayName?: string;
    };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const displayName = body.displayName?.trim().slice(0, 80) ?? "";

  if (!email || !password || !displayName) {
    return NextResponse.json({ error: "Informe nome, e-mail e senha." }, { status: 400 });
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` },
      { status: 400 },
    );
  }

  const emailLimited = await enforceRateLimit(
    request,
    "auth-signup",
    RATE_LIMITS.authSlow,
    email,
  );
  if (emailLimited) return emailLimited;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${requestOrigin(request)}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: authErrorMessage(error.message) },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, session: Boolean(data.session) });
}
