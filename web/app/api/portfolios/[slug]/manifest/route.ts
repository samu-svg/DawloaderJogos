import { NextResponse } from "next/server";
import {
  MANIFEST_VERSION,
  type Manifest,
  type ResolvedManifestEntry,
  validateDestination,
} from "@/lib/manifest";
import { resolveManifestAccess } from "@/lib/manifest-access";
import { downloadUrlTtl, signDownloadUrl } from "@/lib/storage";
import { createPublicReaderClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const access = await resolveManifestAccess(request, slug);

  if (!access.allowed) {
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

  const { data: portfolio, error: portfolioError } = await supabase
    .from("portfolios")
    .select("id, slug, title, description, updated_at")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (portfolioError) {
    console.error("Falha ao consultar o portfólio:", portfolioError);
    return NextResponse.json(
      { error: "Não foi possível consultar o catálogo." },
      { status: 502 },
    );
  }

  if (!portfolio) {
    return NextResponse.json(
      { error: "Portfólio não encontrado." },
      { status: 404 },
    );
  }

  const { data: rows, error } = await supabase
    .from("entries")
    .select(
      "id, label, destination, size_bytes, sha256, kind, storage_key, external_url, is_optional, group_name",
    )
    .eq("portfolio_id", portfolio.id)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível carregar os arquivos." },
      { status: 500 },
    );
  }

  const allowedIds = access.entryFilter ? new Set(access.entryFilter) : null;
  const entries: ResolvedManifestEntry[] = [];

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
      sizeBytes: row.size_bytes,
      sha256: row.sha256 ?? undefined,
      optional: row.is_optional || undefined,
      group: row.group_name ?? undefined,
      downloadUrl,
    });
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
}
