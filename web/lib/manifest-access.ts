import type { AppUser } from "@/lib/auth";
import { getApiUser } from "@/lib/auth";
import { includeManifestDownloadUrls } from "@/lib/manifest-download-urls";
import { logWarn } from "@/lib/logger";
import {
  maxBytesPerSecondForPlan,
  type DownloadPlan,
} from "@/lib/plan-limits";
import { hasSubscriptionBypass, parseRole, type Role } from "@/lib/rbac";
import { subscriptionsEnabled } from "@/lib/stripe";
import {
  subscriptionIsActive,
  verifyManifestAccessToken,
} from "@/lib/subscription";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ManifestAccessResult =
  | {
      allowed: true;
      entryFilter: string[] | null;
      /**
       * Whether the caller may receive signed download URLs.
       *
       * A signed URL works for anyone who holds it, so it is only handed to a
       * caller that proved access via the desktop Bearer token (paid catalog or
       * a single-game free install). A plain browser session gets metadata only.
       */
      includeDownloadUrls: boolean;
      downloadPlan: DownloadPlan;
      maxBytesPerSecond: number;
      user?: AppUser | null;
      userId?: string;
    }
  | { allowed: false; status: 401 | 403 | 503; error?: string };

function allowedAccess(input: {
  entryFilter: string[] | null;
  includeDownloadUrls: boolean;
  downloadPlan: DownloadPlan;
  user?: AppUser | null;
  userId?: string;
  maxBytesPerSecond?: number;
}): Extract<ManifestAccessResult, { allowed: true }> {
  return {
    allowed: true,
    entryFilter: input.entryFilter,
    includeDownloadUrls: input.includeDownloadUrls,
    downloadPlan: input.downloadPlan,
    maxBytesPerSecond:
      input.maxBytesPerSecond ?? maxBytesPerSecondForPlan(input.downloadPlan),
    user: input.user,
    userId: input.userId,
  };
}

/** Opening the whole catalog has to be deliberate, never a side effect of missing env vars. */
function acervoAberto(): boolean {
  return process.env.ACERVO_ABERTO?.trim() === "true";
}

async function subscriptionStatusForUser(
  userId: string,
): Promise<{ status: string; current_period_end: string | null } | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export async function resolveManifestAccess(
  request: Request,
  slug: string,
): Promise<ManifestAccessResult> {
  if (!subscriptionsEnabled()) {
    if (acervoAberto()) {
      return allowedAccess({
        entryFilter: null,
        includeDownloadUrls: includeManifestDownloadUrls("open-catalog"),
        downloadPlan: "paid",
      });
    }
    logWarn(
      "Assinaturas desabilitadas e ACERVO_ABERTO desligado — acesso ao manifest negado",
      { slug },
    );
    return {
      allowed: false,
      status: 503,
      error:
        "Catálogo indisponível no momento por configuração do servidor. Tente novamente em instantes.",
    };
  }

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  if (bearer) {
    const payload = verifyManifestAccessToken(bearer, slug);
    if (!payload) {
      return {
        allowed: false,
        status: 401,
        error: "Link de instalação inválido ou expirado. Volte ao site e clique em Instalar no HD.",
      };
    }

    let role: Role = "user";
    try {
      const supabase = createServiceRoleClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", payload.sub)
        .maybeSingle();
      role = parseRole(profile?.role);
    } catch {
      return {
        allowed: false,
        status: 503,
      };
    }

    const entryFilter = payload.entries?.length ? payload.entries : null;

    if (hasSubscriptionBypass(role)) {
      return allowedAccess({
        entryFilter,
        includeDownloadUrls: includeManifestDownloadUrls("bearer"),
        downloadPlan: "paid",
        userId: payload.sub,
      });
    }

    if (payload.plan === "free") {
      if (!entryFilter?.length) {
        return {
          allowed: false,
          status: 403,
          error:
            "No plano grátis só é possível instalar um jogo por vez. Assine para montar o HD em lote.",
        };
      }
      return allowedAccess({
        entryFilter,
        includeDownloadUrls: includeManifestDownloadUrls("bearer"),
        downloadPlan: "free",
        maxBytesPerSecond:
          typeof payload.bps === "number" && payload.bps > 0
            ? payload.bps
            : maxBytesPerSecondForPlan("free"),
        userId: payload.sub,
      });
    }

    const subscription = await subscriptionStatusForUser(payload.sub);
    if (!subscriptionIsActive(subscription)) {
      return { allowed: false, status: 403 };
    }

    return allowedAccess({
      entryFilter,
      includeDownloadUrls: includeManifestDownloadUrls("bearer"),
      downloadPlan: "paid",
      userId: payload.sub,
    });
  }

  const user = await getApiUser();
  if (!user) {
    return { allowed: false, status: 401 };
  }

  if (hasSubscriptionBypass(user.role)) {
    return allowedAccess({
      entryFilter: null,
      includeDownloadUrls: includeManifestDownloadUrls("cookie"),
      downloadPlan: "paid",
      user,
      userId: user.id,
    });
  }

  const subscription = await subscriptionStatusForUser(user.id);
  if (!subscriptionIsActive(subscription)) {
    return { allowed: false, status: 403 };
  }

  return allowedAccess({
    entryFilter: null,
    includeDownloadUrls: includeManifestDownloadUrls("cookie"),
    downloadPlan: "paid",
    user,
    userId: user.id,
  });
}
