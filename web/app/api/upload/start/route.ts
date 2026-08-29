import { NextResponse } from "next/server";
import { recordAudit, requestIp } from "@/lib/audit";
import { logError } from "@/lib/logger";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { buildStorageKey } from "@/lib/storage-keys";
import { PART_SIZE, startUpload } from "@/lib/storage";
import {
  isAllowedUploadContentType,
  isAllowedUploadSize,
  resolveUploadContentType,
} from "@/lib/upload-limits";
import { requirePortfolioUploadAccess } from "@/lib/upload-auth";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "upload-start", RATE_LIMITS.upload);
  if (limited) return limited;

  const body = (await request.json()) as {
    portfolioSlug?: string;
    fileName?: string;
    contentType?: string;
    sizeBytes?: number;
  };

  const portfolioSlug = body.portfolioSlug?.trim();
  const fileName = body.fileName?.trim();
  const contentType = resolveUploadContentType(body.contentType);
  const sizeBytes = Number(body.sizeBytes);

  if (!portfolioSlug || !fileName) {
    return NextResponse.json(
      { error: "Informe o portfólio e o nome do arquivo." },
      { status: 400 },
    );
  }

  if (!isAllowedUploadSize(sizeBytes)) {
    return NextResponse.json(
      { error: "Tamanho do arquivo inválido ou acima do limite de 128 GB." },
      { status: 400 },
    );
  }

  if (!isAllowedUploadContentType(contentType)) {
    return NextResponse.json(
      { error: "Tipo de arquivo não permitido. Envie um zip." },
      { status: 400 },
    );
  }

  const auth = await requirePortfolioUploadAccess(portfolioSlug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userLimited = await enforceRateLimit(
    request,
    "upload-start",
    RATE_LIMITS.upload,
    auth.userId,
  );
  if (userLimited) return userLimited;

  const storageKey = buildStorageKey(auth.portfolio.id, fileName);

  try {
    const uploadId = await startUpload(storageKey, contentType);
    await recordAudit({
      action: "upload.start",
      entity: "portfolio",
      entityId: auth.portfolio.slug,
      ip: requestIp(request),
      metadata: { storageKey },
    });
    return NextResponse.json({
      storageKey,
      uploadId,
      partSize: PART_SIZE,
    });
  } catch (error) {
    logError("R2 startUpload failed", error);
    return NextResponse.json(
      { error: "Não foi possível iniciar o upload no R2." },
      { status: 502 },
    );
  }
}
