import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAudit, requestIp } from "@/lib/audit";
import { getApiUser } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-messages";
import { logError } from "@/lib/logger";
import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_NONCE_COOKIE,
  clearPasswordRecoveryCookieOptions,
} from "@/lib/password-recovery";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isTrustedAuthOrigin } from "@/lib/trusted-origin";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(
    request,
    "auth-reset-password",
    RATE_LIMITS.auth,
  );
  if (limited) return limited;

  if (!isTrustedAuthOrigin(request)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  const user = await getApiUser({ allowRecovery: true });
  if (!user) {
    return NextResponse.json(
      { error: "Link expirado. Solicite uma nova recuperação." },
      { status: 401 },
    );
  }
  if (!user.mustResetPassword) {
    return NextResponse.json(
      { error: "Use a página da conta para trocar a senha." },
      { status: 403 },
    );
  }

  const userLimited = await enforceRateLimit(
    request,
    "auth-reset-password",
    RATE_LIMITS.authSlow,
    user.id,
  );
  if (userLimited) return userLimited;

  let body: { password?: string; confirm?: string };
  try {
    body = (await request.json()) as { password?: string; confirm?: string };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const password = body.password ?? "";
  const confirm = body.confirm ?? "";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` },
      { status: 400 },
    );
  }
  if (password !== confirm) {
    return NextResponse.json({ error: "As senhas não coincidem." }, { status: 400 });
  }
  if (password.toLowerCase() === user.email) {
    return NextResponse.json(
      { error: "A senha não pode ser igual ao e-mail." },
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

  const { error: stampError } = await createServiceRoleClient()
    .from("profiles")
    .update({
      password_changed_at: new Date().toISOString(),
      password_reset_required: false,
    })
    .eq("id", user.id);
  if (stampError) {
    return NextResponse.json(
      {
        error:
          "Senha alterada, mas não foi possível registrar a troca. Entre em contato com o suporte.",
      },
      { status: 500 },
    );
  }

  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch (error) {
    logError("Falha ao encerrar sessões após redefinir senha", error, {
      userId: user.id,
    });
    await supabase.auth.signOut();
  }

  const cookieStore = await cookies();
  cookieStore.set(
    PASSWORD_RECOVERY_COOKIE,
    "",
    clearPasswordRecoveryCookieOptions(),
  );
  cookieStore.set(
    PASSWORD_RECOVERY_NONCE_COOKIE,
    "",
    clearPasswordRecoveryCookieOptions(),
  );

  await recordAudit({
    actorId: user.id,
    action: "password.reset",
    entity: "user",
    entityId: user.id,
    ip: requestIp(request),
  });

  return NextResponse.json({ ok: true });
}
