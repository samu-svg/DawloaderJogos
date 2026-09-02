import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { isR2Configured } from "@/lib/r2-configured";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getSpecialDownload } from "@/lib/special-downloads";
import { downloadUrlTtl, headObjectSize, signDownloadUrl } from "@/lib/storage";
import { userHasCatalogAccess } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const limited = await enforceRateLimit(request, "special-download", RATE_LIMITS.medium);
  if (limited) return limited;

  const { slug } = await params;
  const pack = getSpecialDownload(slug);
  if (!pack) {
    return NextResponse.json({ error: "Download não encontrado." }, { status: 404 });
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Armazenamento indisponível no momento." },
      { status: 503 },
    );
  }

  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para baixar." }, { status: 401 });
  }

  const hasAccess = await userHasCatalogAccess(user);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Assinatura ativa necessária para baixar este pack." },
      { status: 403 },
    );
  }

  try {
    const sizeBytes = await headObjectSize(pack.storageKey);
    const url = await signDownloadUrl(pack.storageKey, pack.downloadFileName);
    return NextResponse.json({
      url,
      fileName: pack.downloadFileName,
      sizeBytes,
      expiresIn: downloadUrlTtl(),
    });
  } catch {
    return NextResponse.json(
      { error: "Arquivo não encontrado no servidor." },
      { status: 404 },
    );
  }
}
