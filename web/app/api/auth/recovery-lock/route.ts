import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { lockRecoverySession } from "@/lib/password-recovery-session";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isTrustedAuthOrigin } from "@/lib/trusted-origin";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(
    request,
    "auth-recovery-lock",
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

  const locked = await lockRecoverySession(user.id, request);
  if (locked.error) {
    return NextResponse.json(
      { error: "Não foi possível concluir. Tente novamente em instantes." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
