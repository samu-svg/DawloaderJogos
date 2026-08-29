import { NextResponse } from "next/server";
import { recordAudit, requestIp } from "@/lib/audit";
import { getApiUser } from "@/lib/auth";
import { assertHdAccess, isValidHdFingerprint } from "@/lib/hd-access";
import { verifyInstallSessionToken } from "@/lib/install-session";
import { passwordIsExpired } from "@/lib/password-policy";
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
    hdFingerprint?: string;
  };

  const hdFingerprint = body.hdFingerprint?.trim().toLowerCase();

  let userId: string | null = null;
  let slug = body.slug?.trim() ?? "";
  let entryIds = normalizeEntryIds(body.entryIds);

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
        { error: "Assinatura ativa necessária." },
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

  if (!hdFingerprint || !isValidHdFingerprint(hdFingerprint)) {
    return NextResponse.json(
      { error: "Escolha a pasta raiz do HD no app antes de continuar." },
      { status: 400 },
    );
  }

  const hdAccess = await assertHdAccess(userId, hdFingerprint);
  if (!hdAccess.ok) {
    await recordAudit({
      actorId: userId,
      action: "hd.register_denied",
      entity: "user_hd",
      ip: requestIp(request),
      metadata: { error: hdAccess.error },
    });
    return NextResponse.json({ error: hdAccess.error }, { status: hdAccess.status });
  }

  await recordAudit({
    actorId: userId,
    action: "hd.register",
    entity: "user_hd",
    ip: requestIp(request),
  });

  const token = createManifestAccessToken({
    userId,
    slug,
    entryIds,
    hdFingerprint,
  });

  if (!token) {
    return NextResponse.json(
      { error: "Token de manifesto não configurado no servidor." },
      { status: 503 },
    );
  }

  return NextResponse.json({ token });
}
