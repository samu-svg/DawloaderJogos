import type { AppUser } from "@/lib/auth";
import { getApiUser } from "@/lib/auth";
import { hasSubscriptionBypass, parseRole, type Role } from "@/lib/rbac";
import {
  subscriptionIsActive,
  verifyManifestAccessToken,
} from "@/lib/subscription";
import { subscriptionsEnabled } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { includeManifestDownloadUrls } from "@/lib/manifest-download-urls";
import { logWarn } from "@/lib/logger";

export type ManifestAccessResult =
  | {
      allowed: true;
      entryFilter: string[] | null;
      /**
       * Whether the caller may receive signed download URLs.
       *
       * A signed URL works for anyone who holds it, so it is only handed to a
       * caller that proved an active subscription via the desktop Bearer token.
       * A plain browser session gets metadata only —
       * otherwise a subscriber could copy the JSON and hand the whole catalog
       * to people with no account at all.
       */
      includeDownloadUrls: boolean;
      user?: AppUser | null;
      userId?: string;
    }
  | { allowed: false; status: 401 | 403 | 503; error?: string };

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
      return {
        allowed: true,
        entryFilter: null,
        includeDownloadUrls: includeManifestDownloadUrls("open-catalog"),
      };
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

    if (hasSubscriptionBypass(role)) {
      return {
        allowed: true,
        entryFilter: payload.entries?.length ? payload.entries : null,
        includeDownloadUrls: includeManifestDownloadUrls("bearer"),
        userId: payload.sub,
      };
    }

    const subscription = await subscriptionStatusForUser(payload.sub);
    if (!subscriptionIsActive(subscription)) {
      return { allowed: false, status: 403 };
    }

    return {
      allowed: true,
      entryFilter: payload.entries?.length ? payload.entries : null,
      includeDownloadUrls: includeManifestDownloadUrls("bearer"),
      userId: payload.sub,
    };
  }

  const user = await getApiUser();
  if (!user) {
    return { allowed: false, status: 401 };
  }

  if (hasSubscriptionBypass(user.role)) {
    return {
      allowed: true,
      entryFilter: null,
      includeDownloadUrls: includeManifestDownloadUrls("cookie"),
      user,
      userId: user.id,
    };
  }

  const subscription = await subscriptionStatusForUser(user.id);
  if (!subscriptionIsActive(subscription)) {
    return { allowed: false, status: 403 };
  }

  return {
    allowed: true,
    entryFilter: null,
    includeDownloadUrls: includeManifestDownloadUrls("cookie"),
    user,
    userId: user.id,
  };
}
