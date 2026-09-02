import { NextResponse } from "next/server";
import { resolveManifestAccess } from "@/lib/manifest-access";
import { isR2Configured } from "@/lib/r2-configured";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildSpecialDownloadManifest,
  getSpecialDownload,
  specialInstallSlug,
} from "@/lib/special-downloads";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const limited = await enforceRateLimit(request, "special-manifest", RATE_LIMITS.medium);
  if (limited) return limited;

  const { slug } = await params;
  const pack = getSpecialDownload(slug);
  if (!pack) {
    return NextResponse.json({ error: "Download não encontrado." }, { status: 404 });
  }

  const access = await resolveManifestAccess(request, specialInstallSlug(pack.slug));
  if (!access.allowed) {
    return NextResponse.json(
      {
        error:
          access.error ??
          (access.status === 403
            ? "Assinatura ativa necessária para baixar este pack."
            : "Faça login ou abra o pack pelo site com sua conta."),
      },
      { status: access.status },
    );
  }

  if (access.userId) {
    const userLimited = await enforceRateLimit(
      request,
      "special-manifest",
      RATE_LIMITS.medium,
      access.userId,
    );
    if (userLimited) return userLimited;
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Armazenamento de downloads não configurado no servidor." },
      { status: 503 },
    );
  }

  try {
    const manifest = await buildSpecialDownloadManifest(
      pack,
      access.includeDownloadUrls,
    );

    if (access.entryFilter?.length) {
      const allowed = new Set(access.entryFilter);
      manifest.entries = manifest.entries.filter((entry) => allowed.has(entry.id));
      if (manifest.entries.length === 0) {
        return NextResponse.json(
          { error: "Pack não autorizado nesta sessão." },
          { status: 403 },
        );
      }
      manifest.totalBytes = manifest.entries.reduce(
        (sum, entry) => sum + entry.sizeBytes,
        0,
      );
    }

    return NextResponse.json(manifest, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível montar o manifesto do pack." },
      { status: 500 },
    );
  }
}
