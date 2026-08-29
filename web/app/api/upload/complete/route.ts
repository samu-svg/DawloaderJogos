import { NextResponse } from "next/server";
import { recordAudit, requestIp } from "@/lib/audit";
import { logError } from "@/lib/logger";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { storageKeyBelongsToPortfolio } from "@/lib/storage-keys";
import { completeUpload } from "@/lib/storage";
import { requirePortfolioUploadAccess } from "@/lib/upload-auth";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "upload-complete", RATE_LIMITS.upload);
  if (limited) return limited;

  const body = (await request.json()) as {
    portfolioSlug?: string;
    storageKey?: string;
    uploadId?: string;
    parts?: { partNumber?: number; etag?: string }[];
  };

  const portfolioSlug = body.portfolioSlug?.trim();
  const storageKey = body.storageKey?.trim();
  const uploadId = body.uploadId?.trim();
  const parts = body.parts;

  if (!portfolioSlug || !storageKey || !uploadId || !Array.isArray(parts) || parts.length === 0) {
    return NextResponse.json({ error: "Parâmetros de conclusão inválidos." }, { status: 400 });
  }

  const normalized = parts
    .map((part) => ({
      partNumber: Number(part.partNumber),
      etag: String(part.etag ?? "").trim(),
    }))
    .filter((part) => Number.isInteger(part.partNumber) && part.partNumber >= 1 && part.etag);

  if (normalized.length !== parts.length) {
    return NextResponse.json({ error: "Lista de partes inválida." }, { status: 400 });
  }

  const auth = await requirePortfolioUploadAccess(portfolioSlug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userLimited = await enforceRateLimit(
    request,
    "upload-complete",
    RATE_LIMITS.upload,
    auth.userId,
  );
  if (userLimited) return userLimited;

  if (!storageKeyBelongsToPortfolio(storageKey, auth.portfolio.id)) {
    return NextResponse.json({ error: "Chave de armazenamento inválida." }, { status: 403 });
  }

  try {
    await completeUpload(storageKey, uploadId, normalized);
    await recordAudit({
      action: "upload.complete",
      entity: "portfolio",
      entityId: auth.portfolio.slug,
      ip: requestIp(request),
      metadata: { storageKey },
    });
    return NextResponse.json({ ok: true, storageKey });
  } catch (error) {
    logError("R2 completeUpload failed", error);
    return NextResponse.json(
      { error: "Não foi possível concluir o upload no R2." },
      { status: 502 },
    );
  }
}
