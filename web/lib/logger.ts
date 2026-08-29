import { Logtail } from "@logtail/node";

let logtail: Logtail | null | undefined;

function client(): Logtail | null {
  if (logtail !== undefined) return logtail;
  const token = process.env.LOGTAIL_SOURCE_TOKEN?.trim();
  logtail = token ? new Logtail(token) : null;
  return logtail;
}

export function logInfo(message: string, data?: Record<string, unknown>): void {
  const logger = client();
  if (logger) {
    void logger.info(message, data);
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(message, data ?? "");
  }
}

export function logWarn(message: string, data?: Record<string, unknown>): void {
  const logger = client();
  if (logger) {
    void logger.warn(message, data);
    return;
  }
  console.warn(message, data ?? "");
}

export function logError(
  message: string,
  error?: unknown,
  data?: Record<string, unknown>,
): void {
  const err =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
  const payload = { ...data, error: err };
  const logger = client();
  if (logger) {
    void logger.error(message, payload);
    return;
  }
  console.error(message, payload);
}
