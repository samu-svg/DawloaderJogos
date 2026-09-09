import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { verifyInstallSessionToken } from "@/lib/install-session";
import { passwordIsExpired } from "@/lib/password-policy";
import { maxBytesPerSecondForPlan } from "@/lib/plan-limits";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { subscriptionsEnabled } from "@/lib/stripe";
import {
  createManifestAccessToken,
  userHasCatalogAccess,
} from "@/lib/subscription";

function normalizeEntryIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = [
    ...new Set(
      raw
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
  return ids.length ? ids : undefined;
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "manifest-token", RATE_LIMITS.tight);
  if (limited) return limited;

  const body = (await request.json()) as {
    slug?: string;
    entryIds?: string[];
    session?: string;
  };

  let userId: string | null = null;
  let slug = body.slug?.trim() ?? "";
  let entryIds = normalizeEntryIds(body.entryIds);
  let plan: "free" | "paid" = "paid";
  let maxBytesPerSecond = 0;

  const sessionToken = body.session?.trim();
  if (sessionToken) {
    const session = verifyInstallSessionToken(sessionToken);
    if (!session) {
      return NextResponse.json(
        { error: "Sessão expirada. Volte ao site e clique em Instalar no HD." },
        { status: 401 },
      );
    }
    userId = session.sub;
    slug = session.slug;
    entryIds = session.entries;
    plan = session.plan === "free" ? "free" : "paid";
    maxBytesPerSecond =
      plan === "free"
        ? session.bps && session.bps > 0
          ? session.bps
          : maxBytesPerSecondForPlan("free")
        : 0;

    if (plan === "free" && !entryIds?.length) {
      return NextResponse.json(
        {
          error:
            "No plano Grátis só é possível instalar um jogo por vez. Assine o Completo para montar o HD em lote.",
          code: "PAID_REQUIRED",
        },
        { status: 403 },
      );
    }
  } else {
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
    userId = user.id;

    if (!(await userHasCatalogAccess(user))) {
      return NextResponse.json(
        {
          error:
            "No plano Grátis abra um jogo no site e clique em Instalar no HD.",
          code: "PAID_REQUIRED",
        },
        { status: 403 },
      );
    }
  }

  const userLimited = await enforceRateLimit(
    request,
    "manifest-token",
    RATE_LIMITS.tight,
    userId,
  );
  if (userLimited) return userLimited;

  if (!slug) {
    return NextResponse.json(
      { error: "Informe o slug do catálogo." },
      { status: 400 },
    );
  }

  if (!subscriptionsEnabled()) {
    return NextResponse.json({ token: null });
  }

  const token = createManifestAccessToken({
    userId,
    slug,
    entryIds,
    plan,
    maxBytesPerSecond,
  });

  if (!token) {
    return NextResponse.json(
      { error: "Token de manifesto não configurado no servidor." },
      { status: 503 },
    );
  }

  return NextResponse.json({ token });
}
