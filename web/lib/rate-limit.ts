import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { logWarn } from "@/lib/logger";
import { requestIp } from "@/lib/audit";
import {
  memoryLimit,
  type RateWindow,
  windowToMs,
} from "@/lib/rate-limit-memory";

type Window = RateWindow;

export const RATE_LIMITS = {
  tight: { limit: 10, window: "1 m" as Window },
  medium: { limit: 60, window: "1 m" as Window },
  upload: { limit: 30, window: "1 m" as Window },
  /** One call per 64 MiB part, so a fast link needs plenty of headroom. */
  uploadPart: { limit: 300, window: "1 m" as Window },
} as const;

const redisLimiters = new Map<string, Ratelimit>();

function upstashLimiter(limit: number, window: Window): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  const cacheKey = `${limit}:${window}`;
  const existing = redisLimiters.get(cacheKey);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: "montahd",
  });
  redisLimiters.set(cacheKey, limiter);
  return limiter;
}

const REDIS_WARN_INTERVAL_MS = 60_000;

let missingUpstashWarned = false;
let redisErrorWarnedAt = 0;

/** Degraded mode is a per-request condition; warn once so logs stay readable. */
function warnMissingUpstash(bucket: string): void {
  if (missingUpstashWarned) return;
  missingUpstashWarned = true;
  logWarn("Rate limit sem Upstash — usando limitador em memória (não distribuído)", {
    bucket,
  });
}

function warnRedisError(bucket: string, error: unknown): void {
  const now = Date.now();
  if (now - redisErrorWarnedAt < REDIS_WARN_INTERVAL_MS) return;
  redisErrorWarnedAt = now;
  logWarn("Rate limit Upstash indisponível — usando limitador em memória", {
    bucket,
    error: error instanceof Error ? error.message : String(error),
  });
}

function tooManyRequests(headers: Record<string, string>): NextResponse {
  return NextResponse.json(
    { error: "Muitas tentativas. Aguarde um instante." },
    { status: 429, headers },
  );
}

function enforceInMemory(
  identity: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  if (memoryLimit(identity, limit, windowMs)) return null;
  return tooManyRequests({
    "Retry-After": String(Math.max(1, Math.ceil(windowMs / 1000))),
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": "0",
  });
}

export async function enforceRateLimit(
  request: Request,
  bucket: string,
  opts: { limit: number; window: Window },
  userId?: string,
): Promise<NextResponse | null> {
  const ip = requestIp(request) ?? "unknown";
  const identity = userId ? `${bucket}:user:${userId}` : `${bucket}:ip:${ip}`;
  const windowMs = windowToMs(opts.window);

  const limiter = upstashLimiter(opts.limit, opts.window);
  if (limiter) {
    try {
      const result = await limiter.limit(identity);
      if (result.success) return null;
      return tooManyRequests({
        "Retry-After": String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      });
    } catch (error) {
      warnRedisError(bucket, error);
      return enforceInMemory(identity, opts.limit, windowMs);
    }
  }

  if (process.env.NODE_ENV === "production") {
    warnMissingUpstash(bucket);
  }

  return enforceInMemory(identity, opts.limit, windowMs);
}
