import { Transform } from "node:stream";

export function throttleDelayMs(
  bytes: number,
  maxBytesPerSecond: number,
): number {
  if (maxBytesPerSecond <= 0 || bytes <= 0) return 0;
  return Math.ceil((bytes / maxBytesPerSecond) * 1000);
}

export function parseMaxBytesPerSecond(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Pausado"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Pausado"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export class ByteRateLimiter {
  private readonly maxBytesPerSecond: number;

  constructor(maxBytesPerSecond: number) {
    this.maxBytesPerSecond = maxBytesPerSecond;
  }

  async take(bytes: number, signal?: AbortSignal): Promise<void> {
    const waitMs = throttleDelayMs(bytes, this.maxBytesPerSecond);
    if (waitMs > 0) await sleep(waitMs, signal);
  }
}

export function createByteRateLimitTransform(
  maxBytesPerSecond: number,
  signal?: AbortSignal,
): Transform {
  const limiter = new ByteRateLimiter(maxBytesPerSecond);
  return new Transform({
    async transform(chunk: Buffer, _encoding, callback) {
      try {
        await limiter.take(chunk.length, signal);
        callback(null, chunk);
      } catch (error) {
        callback(error as Error);
      }
    },
  });
}
