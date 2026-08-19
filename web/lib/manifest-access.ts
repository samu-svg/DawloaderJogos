import { isPortfolioAdmin } from "@/lib/admin";
import {
  subscriptionIsActive,
  verifyManifestAccessToken,
} from "@/lib/subscription";
import { subscriptionsEnabled } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { currentUser } from "@/lib/supabase/server";

export type ManifestAccessResult =
  | { allowed: true; entryFilter: string[] | null }
  | { allowed: false; status: 401 | 403 };

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

    const supabase = createServiceRoleClient();
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", payload.sub)
      .maybeSingle();

    const { data: authUser } = await supabase.auth.admin.getUserById(payload.sub);
    if (isPortfolioAdmin(authUser.user?.email)) {
      return {
        allowed: true,
        entryFilter: payload.entries?.length ? payload.entries : null,
      };
    }

    if (!subscriptionIsActive(subscription)) {
      return { allowed: false, status: 403 };
    }

    return {
      allowed: true,
      entryFilter: payload.entries?.length ? payload.entries : null,
    };
  }

  const user = await currentUser();
  if (!user) {
    return { allowed: false, status: 401 };
  }

  if (isPortfolioAdmin(user.email)) {
    return { allowed: true, entryFilter: null };
  }

  const supabase = createServiceRoleClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subscriptionIsActive(subscription)) {
    return { allowed: false, status: 403 };
  }

  return { allowed: true, entryFilter: null };
}
