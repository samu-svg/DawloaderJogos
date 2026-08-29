import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { storageKeyBelongsToPortfolio } from "@/lib/storage-keys";
import { signUploadPart } from "@/lib/storage";
import { requirePortfolioUploadAccess } from "@/lib/upload-auth";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "upload-sign", RATE_LIMITS.upload);
  if (limited) return limited;

  const body = (await request.json()) as {
    portfolioSlug?: string;
    storageKey?: string;
    uploadId?: string;
    partNumber?: number;
  };

  const portfolioSlug = body.portfolioSlug?.trim();
  const storageKey = body.storageKey?.trim();
  const uploadId = body.uploadId?.trim();
  const partNumber = Number(body.partNumber);

  if (!portfolioSlug || !storageKey || !uploadId || !Number.isInteger(partNumber)) {
    return NextResponse.json({ error: "Parâmetros de upload inválidos." }, { status: 400 });
  }

  if (partNumber < 1 || partNumber > 10_000) {
    return NextResponse.json({ error: "Número da parte inválido." }, { status: 400 });
  }

  const auth = await requirePortfolioUploadAccess(portfolioSlug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!storageKeyBelongsToPortfolio(storageKey, auth.portfolio.id)) {
    return NextResponse.json({ error: "Chave de armazenamento inválida." }, { status: 403 });
  }

  try {
    const url = await signUploadPart(storageKey, uploadId, partNumber);
    return NextResponse.json({ url });
  } catch (error) {
    logError("R2 signUploadPart failed", error);
    return NextResponse.json(
      { error: "Não foi possível assinar a parte do upload." },
      { status: 502 },
    );
  }
}
