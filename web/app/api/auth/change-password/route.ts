import { NextResponse } from "next/server";
import { authErrorMessage } from "@/lib/auth-messages";
import { getApiUser } from "@/lib/auth";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isTrustedAuthOrigin } from "@/lib/trusted-origin";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(
    request,
    "auth-change-password",
    RATE_LIMITS.auth,
  );
  if (limited) return limited;

  if (!isTrustedAuthOrigin(request)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }

  const userLimited = await enforceRateLimit(
    request,
    "auth-change-password",
    RATE_LIMITS.authSlow,
    user.id,
  );
  if (userLimited) return userLimited;

  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const password = body.password ?? "";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return NextResponse.json(
      { error: authErrorMessage(error.message) },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
