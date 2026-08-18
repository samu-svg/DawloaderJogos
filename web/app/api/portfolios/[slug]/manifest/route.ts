import { NextResponse } from "next/server";
import {
  MANIFEST_VERSION,
  type Manifest,
  type ResolvedManifestEntry,
  validateDestination,
} from "@/lib/manifest";
import { downloadUrlTtl, signDownloadUrl } from "@/lib/storage";
import { createPublicReaderClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createPublicReaderClient();

  // Row level security limits this to public portfolios, so an unlisted one
  // simply comes back empty.
  const { data: portfolio, error: portfolioError } = await supabase
    .from("portfolios")
    .select("id, slug, title, description, updated_at")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  // A failure to reach the database must not masquerade as "not found", or a
  // misconfigured deployment looks like an empty catalogue.
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

  const entries: ResolvedManifestEntry[] = [];

  for (const row of rows ?? []) {
    // The path was validated when it was saved and again by a database
    // constraint, but it reaches a filesystem from here, so it is checked
    // once more rather than trusted.
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
