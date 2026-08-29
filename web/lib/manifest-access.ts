import type { AppUser } from "@/lib/auth";
import { getApiUser } from "@/lib/auth";
import { userOwnsHdFingerprint } from "@/lib/hd-access";
import { hasSubscriptionBypass, isBootstrapAdminEmail } from "@/lib/rbac";
import {
  subscriptionIsActive,
  verifyManifestAccessToken,
} from "@/lib/subscription";
import { subscriptionsEnabled } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logWarn } from "@/lib/logger";

export type ManifestAccessResult =
  | {
      allowed: true;
      entryFilter: string[] | null;
      user?: AppUser | null;
      userId?: string;
    }
  | { allowed: false; status: 401 | 403 | 503; error?: string };

/** Opening the whole catalog has to be deliberate, never a side effect of missing env vars. */
function acervoAberto(): boolean {
  return process.env.ACERVO_ABERTO?.trim() === "true";
}

async function subscriptionStatusForUser(userId: string): Promise<string | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.status ?? null;
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
      return { allowed: true, entryFilter: null };
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

    let role: "admin" | "user" = "user";
    try {
      const supabase = createServiceRoleClient();
      const { data: authUser } = await supabase.auth.admin.getUserById(payload.sub);
      role = isBootstrapAdminEmail(authUser.user?.email) ? "admin" : "user";
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
        userId: payload.sub,
      };
    }

    const status = await subscriptionStatusForUser(payload.sub);
    if (!subscriptionIsActive(status ? { status } : null)) {
      return { allowed: false, status: 403 };
    }

    if (!payload.hd) {
      return {
        allowed: false,
        status: 403,
        error:
          "Autorize a pasta do HD no app antes de baixar. Volte ao site, clique em Instalar no HD e escolha a pasta do disco.",
      };
    }

    const ownsHd = await userOwnsHdFingerprint(payload.sub, payload.hd);
    if (!ownsHd) {
      return {
        allowed: false,
        status: 403,
        error:
          "Este HD não está vinculado à sua conta. Use o HD registrado ou troque em /conta se o plano permitir.",
      };
    }

    return {
      allowed: true,
      entryFilter: payload.entries?.length ? payload.entries : null,
      userId: payload.sub,
    };
  }

  const user = await getApiUser();
  if (!user) {
    return { allowed: false, status: 401 };
  }

  if (hasSubscriptionBypass(user.role)) {
    return { allowed: true, entryFilter: null, user, userId: user.id };
  }

  const status = await subscriptionStatusForUser(user.id);
  if (!subscriptionIsActive(status ? { status } : null)) {
    return { allowed: false, status: 403 };
  }

  return { allowed: true, entryFilter: null, user, userId: user.id };
}
