import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { logWarn } from "@/lib/logger";
import { requestIp } from "@/lib/audit";

type Window = `${number} ms` | `${number} s` | `${number} m` | `${number} h`;

export const RATE_LIMITS = {
  tight: { limit: 10, window: "1 m" as Window },
  medium: { limit: 60, window: "1 m" as Window },
  upload: { limit: 30, window: "1 m" as Window },
} as const;

const memoryHits = new Map<string, number[]>();

function memoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const stamps = (memoryHits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (stamps.length >= limit) {
    memoryHits.set(key, stamps);
    return false;
  }
  stamps.push(now);
  memoryHits.set(key, stamps);
  return true;
}

function windowToMs(window: Window): number {
  const [, amount, unit] = window.match(/^(\d+)\s*(ms|s|m|h)$/) ?? [];
  const n = Number(amount);
  if (unit === "ms") return n;
  if (unit === "s") return n * 1000;
  if (unit === "m") return n * 60_000;
  return n * 3_600_000;
}

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

export async function enforceRateLimit(
  request: Request,
  bucket: string,
  opts: { limit: number; window: Window },
  userId?: string,
): Promise<NextResponse | null> {
  const ip = requestIp(request) ?? "unknown";
  const identity = userId ? `${bucket}:user:${userId}` : `${bucket}:ip:${ip}`;

  const limiter = upstashLimiter(opts.limit, opts.window);
  if (limiter) {
    try {
      const result = await limiter.limit(identity);
      if (result.success) return null;
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde um instante." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))),
            "X-RateLimit-Limit": String(result.limit),
            "X-RateLimit-Remaining": String(result.remaining),
          },
        },
      );
    } catch (error) {
      logWarn("Rate limit Upstash indisponível — permitindo a requisição", {
        bucket,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  if (process.env.NODE_ENV === "production") {
    logWarn("Rate limit sem Upstash — permitindo a requisição", { bucket });
    return null;
  }

  const allowed = memoryLimit(identity, opts.limit, windowToMs(opts.window));
  if (allowed) return null;
  return NextResponse.json(
    { error: "Muitas tentativas. Aguarde um instante." },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}
