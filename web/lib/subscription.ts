import { createHmac, timingSafeEqual } from "node:crypto";
import type { AppUser } from "@/lib/auth";
import {
  afterAuthPath,
  isDownloadPlan,
  maxBytesPerSecondForPlan,
  type DownloadPlan,
} from "@/lib/plan-limits";
import { hasSubscriptionBypass } from "@/lib/rbac";
import { subscriptionsEnabled } from "@/lib/stripe";
import { subscriptionIsActive } from "@/lib/subscription-active";
import { createClient } from "@/lib/supabase/server";

export { subscriptionIsActive } from "@/lib/subscription-active";

export type SubscriptionRow = {
  status: string;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
};

export async function getUserSubscription(
  userId: string,
): Promise<SubscriptionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return data;
}

export async function userHasCatalogAccess(user: AppUser): Promise<boolean> {
  if (hasSubscriptionBypass(user.role)) return true;
  if (!subscriptionsEnabled()) return true;

  const subscription = await getUserSubscription(user.id);
  return subscriptionIsActive(subscription);
}

export async function userDownloadPlan(user: AppUser): Promise<DownloadPlan> {
  return (await userHasCatalogAccess(user)) ? "paid" : "free";
}

export { afterAuthPath };

export type ManifestTokenPayload = {
  sub: string;
  slug: string;
  entries?: string[];
  hd?: string;
  exp: number;
  plan?: DownloadPlan;
  bps?: number;
};

function manifestTokenSecret(): string | null {
  return process.env.MANIFEST_TOKEN_SECRET?.trim() || null;
}

export function createManifestAccessToken(input: {
  userId: string;
  slug: string;
  entryIds?: string[];
  hdFingerprint?: string;
  plan?: DownloadPlan;
  maxBytesPerSecond?: number;
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

  if (input.hdFingerprint) {
    payload.hd = input.hdFingerprint.trim().toLowerCase();
  }

  if (input.plan) {
    payload.plan = input.plan;
  }

  const bps =
    input.maxBytesPerSecond ??
    (input.plan ? maxBytesPerSecondForPlan(input.plan) : 0);
  if (bps > 0) {
    payload.bps = Math.floor(bps);
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
    if (payload.plan && !isDownloadPlan(payload.plan)) return null;

    return payload;
  } catch {
    return null;
  }
}
