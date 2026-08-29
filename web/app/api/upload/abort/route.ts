import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { storageKeyBelongsToPortfolio } from "@/lib/storage-keys";
import { abortUpload } from "@/lib/storage";
import { requirePortfolioUploadAccess } from "@/lib/upload-auth";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "upload-abort", RATE_LIMITS.upload);
  if (limited) return limited;

  const body = (await request.json()) as {
    portfolioSlug?: string;
    storageKey?: string;
    uploadId?: string;
  };

  const portfolioSlug = body.portfolioSlug?.trim();
  const storageKey = body.storageKey?.trim();
  const uploadId = body.uploadId?.trim();

  if (!portfolioSlug || !storageKey || !uploadId) {
    return NextResponse.json({ error: "Parâmetros de cancelamento inválidos." }, { status: 400 });
  }

  const auth = await requirePortfolioUploadAccess(portfolioSlug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userLimited = await enforceRateLimit(
    request,
    "upload-abort",
    RATE_LIMITS.upload,
    auth.userId,
  );
  if (userLimited) return userLimited;

  if (!storageKeyBelongsToPortfolio(storageKey, auth.portfolio.id)) {
    return NextResponse.json({ error: "Chave de armazenamento inválida." }, { status: 403 });
  }

  try {
    await abortUpload(storageKey, uploadId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("R2 abortUpload failed", error);
    return NextResponse.json(
      { error: "Não foi possível cancelar o upload no R2." },
      { status: 502 },
    );
  }
}
