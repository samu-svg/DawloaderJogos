export type RateWindow = `${number} ms` | `${number} s` | `${number} m` | `${number} h`;

export function windowToMs(window: RateWindow): number {
  const [, amount, unit] = window.match(/^(\d+)\s*(ms|s|m|h)$/) ?? [];
  const n = Number(amount);
  if (unit === "ms") return n;
  if (unit === "s") return n * 1000;
  if (unit === "m") return n * 60_000;
  return n * 3_600_000;
}

type Hits = { stamps: number[]; windowMs: number };

const memoryHits = new Map<string, Hits>();

const SWEEP_EVERY_CALLS = 256;
const MAX_KEYS = 10_000;

let callsSinceSweep = 0;

function lastStamp(hits: Hits): number {
  return hits.stamps[hits.stamps.length - 1] ?? 0;
}

function sweep(now: number): void {
  for (const [key, hits] of memoryHits) {
    const alive = hits.stamps.filter((time) => now - time < hits.windowMs);
    if (alive.length === 0) {
      memoryHits.delete(key);
      continue;
    }
    hits.stamps = alive;
  }

  const excess = memoryHits.size - MAX_KEYS;
  if (excess <= 0) return;

  const oldestFirst = [...memoryHits.entries()].sort(
    (a, b) => lastStamp(a[1]) - lastStamp(b[1]),
  );
  for (const [key] of oldestFirst.slice(0, excess)) {
    memoryHits.delete(key);
  }
}

/**
 * Per-instance sliding window. Serverless instances do not share this map, so the
 * effective limit is `limit * hot instances` — good enough to slow brute force,
 * not a substitute for a distributed limiter.
 */
export function memoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  callsSinceSweep += 1;
  if (callsSinceSweep >= SWEEP_EVERY_CALLS || memoryHits.size > MAX_KEYS) {
    callsSinceSweep = 0;
    sweep(now);
  }

  const stamps = (memoryHits.get(key)?.stamps ?? []).filter(
    (time) => now - time < windowMs,
  );

  if (stamps.length >= limit) {
    memoryHits.set(key, { stamps, windowMs });
    return false;
  }

  stamps.push(now);
  memoryHits.set(key, { stamps, windowMs });
  return true;
}

export function memoryLimitKeyCount(): number {
  return memoryHits.size;
}

export function resetMemoryLimit(): void {
  memoryHits.clear();
  callsSinceSweep = 0;
}
