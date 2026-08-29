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

export function requestIp(request: Request): string | null {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}
