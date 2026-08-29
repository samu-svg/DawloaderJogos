import { NextResponse } from "next/server";
import { recordAudit, requestIp } from "@/lib/audit";
import { logError } from "@/lib/logger";
import {
  MANIFEST_VERSION,
  type Manifest,
  type ResolvedManifestEntry,
  validateDestination,
} from "@/lib/manifest";
import { resolveManifestAccess } from "@/lib/manifest-access";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createPublicReaderClient } from "@/lib/supabase/server";
import { downloadUrlTtl, signDownloadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const limited = await enforceRateLimit(request, "manifest", RATE_LIMITS.medium);
    if (limited) return limited;

    const { slug } = await params;
    const access = await resolveManifestAccess(request, slug);
    const ip = requestIp(request);

    if (!access.allowed) {
      await recordAudit({
        action: "manifest.denied",
        entity: "portfolio",
        entityId: slug,
        ip,
        metadata: { status: access.status },
      });
      return NextResponse.json(
        {
          error:
            access.status === 403
              ? "Assinatura ativa necessária para baixar este catálogo."
              : "Faça login ou abra o catálogo pelo site com sua conta.",
        },
        { status: access.status },
      );
    }

    const supabase = await createPublicReaderClient();
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id, slug, title, description, updated_at")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!portfolio) {
    return NextResponse.json(
      { error: "Portfólio não encontrado." },
      { status: 404 },
    );
  }

  const { data: rows } = await supabase
    .from("entries")
    .select("*")
    .eq("portfolio_id", portfolio.id)
    .order("sort_order", { ascending: true });

  const allowedIds = access.entryFilter ? new Set(access.entryFilter) : null;
  const entries: ResolvedManifestEntry[] = [];

  try {
    for (const row of rows ?? []) {
      if (allowedIds && !allowedIds.has(row.id)) continue;

      const path = validateDestination(row.destination);
      if (!path.ok) continue;

      const downloadUrl =
        row.kind === "hosted"
          ? row.storage_key
            ? await signDownloadUrl(row.storage_key, row.label)
            : null
          : row.external_url;

      if (!downloadUrl) continue;

      entries.push({
        id: row.id,
        label: row.label,
        destination: path.destination,
        sizeBytes: Number(row.size_bytes),
        sha256: row.sha256 ?? undefined,
        optional: row.is_optional || undefined,
        group: row.group_name ?? undefined,
        downloadUrl,
      });
    }
  } catch (error) {
    logError("Falha ao montar o manifesto", error, { slug });
    return NextResponse.json(
      { error: "Não foi possível carregar os arquivos." },
      { status: 500 },
    );
  }

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "Nenhum jogo disponível neste catálogo." },
      { status: 404 },
    );
  }

  const manifest: Manifest = {
    version: MANIFEST_VERSION,
    portfolio: {
      slug: portfolio.slug,
      title: portfolio.title,
      description: portfolio.description,
      updatedAt: portfolio.updated_at,
    },
    totalBytes: entries.reduce((sum, entry) => sum + entry.sizeBytes, 0),
    expiresAt: new Date(Date.now() + downloadUrlTtl() * 1000).toISOString(),
    entries,
  };

  return NextResponse.json(manifest, {
    headers: { "cache-control": "no-store" },
  });
  } catch (error) {
    logError("Falha inesperada no manifesto", error);
    return NextResponse.json(
      { error: "Não foi possível carregar o catálogo." },
      { status: 500 },
    );
  }
}
