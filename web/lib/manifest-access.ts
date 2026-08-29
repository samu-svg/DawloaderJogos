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

export type ManifestAccessResult =
  | { allowed: true; entryFilter: string[] | null; user?: AppUser | null }
  | { allowed: false; status: 401 | 403 | 503 };

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
    return { allowed: true, entryFilter: null };
  }

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  if (bearer) {
    const payload = verifyManifestAccessToken(bearer, slug);
    if (!payload) {
      return { allowed: false, status: 401 };
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
      };
    }

    const status = await subscriptionStatusForUser(payload.sub);
    if (!subscriptionIsActive(status ? { status } : null)) {
      return { allowed: false, status: 403 };
    }

    if (!payload.hd) {
      return { allowed: false, status: 403 };
    }

    const ownsHd = await userOwnsHdFingerprint(payload.sub, payload.hd);
    if (!ownsHd) {
      return { allowed: false, status: 403 };
    }

    return {
      allowed: true,
      entryFilter: payload.entries?.length ? payload.entries : null,
    };
  }

  const user = await getApiUser();
  if (!user) {
    return { allowed: false, status: 401 };
  }

  if (hasSubscriptionBypass(user.role)) {
    return { allowed: true, entryFilter: null, user };
  }

  const status = await subscriptionStatusForUser(user.id);
  if (!subscriptionIsActive(status ? { status } : null)) {
    return { allowed: false, status: 403 };
  }

  return { allowed: true, entryFilter: null, user };
}
