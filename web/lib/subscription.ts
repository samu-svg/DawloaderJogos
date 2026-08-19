import { createHmac, timingSafeEqual } from "node:crypto";
import { isPortfolioAdmin } from "@/lib/admin";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  subscriptionsEnabled,
} from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type SubscriptionRow = {
  status: string;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
};

export async function getUserSubscription(
  userId: string,
): Promise<SubscriptionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

export function subscriptionIsActive(
  subscription: { status: string } | null | undefined,
): boolean {
  if (!subscription) return false;
  return ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);
}

export async function userHasCatalogAccess(user: User): Promise<boolean> {
  if (isPortfolioAdmin(user.email)) return true;
  if (!subscriptionsEnabled()) return true;

  const subscription = await getUserSubscription(user.id);
  return subscriptionIsActive(subscription);
}

export type ManifestTokenPayload = {
  sub: string;
  slug: string;
  entries?: string[];
  exp: number;
};

function manifestTokenSecret(): string | null {
  return process.env.MANIFEST_TOKEN_SECRET?.trim() || null;
}

export function createManifestAccessToken(input: {
  userId: string;
  slug: string;
  entryIds?: string[];
  ttlSeconds?: number;
}): string | null {
  const secret = manifestTokenSecret();
  if (!secret) return null;

  const payload: ManifestTokenPayload = {
    sub: input.userId,
    slug: input.slug,
    exp: Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? 3600),
  };

  if (input.entryIds?.length) {
    payload.entries = input.entryIds;
  }

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyManifestAccessToken(
  token: string,
  slug: string,
): ManifestTokenPayload | null {
  const secret = manifestTokenSecret();
  if (!secret) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as ManifestTokenPayload;

    if (payload.slug !== slug) return null;
    if (!payload.sub || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
