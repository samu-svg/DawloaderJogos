import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { isSingleGameInstall } from "@/lib/free-install";
import { createInstallSessionToken } from "@/lib/install-session";
import { passwordIsExpired } from "@/lib/password-policy";
import { maxBytesPerSecondForPlan } from "@/lib/plan-limits";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { hasSubscriptionBypass } from "@/lib/rbac";
import { subscriptionsEnabled } from "@/lib/stripe";
import { userDownloadPlan } from "@/lib/subscription";
import { entryIdsRequireVip } from "@/lib/vip-install";
import { VIP_REQUIRED_MESSAGE } from "@/lib/vip-games";

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

  const plan = await userDownloadPlan(user);
  if (plan === "free") {
    if (
      !hasSubscriptionBypass(user.role) &&
      entryIds?.length &&
      (await entryIdsRequireVip(slug, entryIds))
    ) {
      return NextResponse.json(
        {
          error: VIP_REQUIRED_MESSAGE,
          code: "VIP_REQUIRED",
        },
        { status: 403 },
      );
    }

    if (!entryIds?.length || !(await isSingleGameInstall(slug, entryIds))) {
      return NextResponse.json(
        {
          error:
            "No plano Grátis só é possível instalar um jogo por vez. Assine o Completo para montar o HD em lote.",
          code: "PAID_REQUIRED",
        },
        { status: 403 },
      );
    }
  }

  if (!subscriptionsEnabled()) {
    return NextResponse.json({ session: null });
  }

  const session = createInstallSessionToken({
    userId: user.id,
    slug,
    entryIds,
    plan,
    maxBytesPerSecond: maxBytesPerSecondForPlan(plan),
  });

  if (!session) {
    return NextResponse.json(
      { error: "Sessão de instalação não configurada no servidor." },
      { status: 503 },
    );
  }

  return NextResponse.json({ session });
}
