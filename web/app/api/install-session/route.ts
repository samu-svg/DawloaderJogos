import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { createInstallSessionToken } from "@/lib/install-session";
import { passwordIsExpired } from "@/lib/password-policy";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { subscriptionsEnabled } from "@/lib/stripe";
import { userHasCatalogAccess } from "@/lib/subscription";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "install-session", RATE_LIMITS.tight);
  if (limited) return limited;

  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }
  if (passwordIsExpired(user.passwordChangedAt)) {
    return NextResponse.json(
      { error: "Senha expirada. Atualize em /conta.", code: "PASSWORD_EXPIRED" },
      { status: 403 },
    );
  }

  const userLimited = await enforceRateLimit(
    request,
    "install-session",
    RATE_LIMITS.tight,
    user.id,
  );
  if (userLimited) return userLimited;

  if (!(await userHasCatalogAccess(user))) {
    return NextResponse.json(
      { error: "Assinatura ativa necessária." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    slug?: string;
    entryIds?: string[];
  };

  const slug = body.slug?.trim();
  if (!slug) {
    return NextResponse.json(
      { error: "Informe o slug do catálogo." },
      { status: 400 },
    );
  }

  const entryIds = Array.isArray(body.entryIds)
    ? [
        ...new Set(
          body.entryIds
            .filter((id): id is string => typeof id === "string")
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ]
    : undefined;

  if (!subscriptionsEnabled()) {
    return NextResponse.json({ session: null });
  }

  const session = createInstallSessionToken({
    userId: user.id,
    slug,
    entryIds,
  });

  if (!session) {
    return NextResponse.json(
      { error: "Sessão de instalação não configurada no servidor." },
      { status: 503 },
    );
  }

  return NextResponse.json({ session });
}
