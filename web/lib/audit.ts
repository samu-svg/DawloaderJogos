import { logError, logInfo } from "@/lib/logger";

export async function recordAudit(input: {
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  try {
    logInfo("audit", {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      actorId: input.actorId,
      ip: input.ip,
    });
  } catch (error) {
    logError("Falha ao gravar auditoria", error, { action: input.action });
  }
}

function firstValue(raw: string | null): string | null {
  return raw?.split(",")[0]?.trim() || null;
}

/** Rightmost hop is the one written by the closest proxy; the left side is client input. */
function lastValue(raw: string | null): string | null {
  const parts = raw?.split(",") ?? [];
  return parts[parts.length - 1]?.trim() || null;
}

export function requestIp(request: Request): string | null {
  const vercelIp =
    firstValue(request.headers.get("x-vercel-forwarded-for")) ??
    firstValue(request.headers.get("x-real-ip"));
  if (vercelIp) return vercelIp;

  // Off Vercel these headers are pure client input, so they are only a dev fallback.
  if (process.env.VERCEL) return null;

  return (
    firstValue(request.headers.get("cf-connecting-ip")) ??
    lastValue(request.headers.get("x-forwarded-for"))
  );
}
