import { NextResponse } from "next/server";
import { recordAudit, requestIp } from "@/lib/audit";
import { logError } from "@/lib/logger";
import {
  MANIFEST_VERSION,
  type Manifest,
  type ManifestPreview,
  type ResolvedManifestEntry,
  normalizeManifestSha256,
  omitDownloadUrls,
  validateDestination,
} from "@/lib/manifest";
import { resolveManifestAccess } from "@/lib/manifest-access";
import { isR2Configured } from "@/lib/r2-configured";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createPublicReaderClient } from "@/lib/supabase/server";
import { downloadUrlTtl, signDownloadUrl } from "@/lib/storage";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";
/** Catálogo grande (180+ jogos) precisa de mais tempo para assinar URLs no R2. */
export const maxDuration = 60;

type EntryRow = Database["public"]["Tables"]["entries"]["Row"];

async function resolveManifestEntries(
  rows: EntryRow[],
  allowedIds: Set<string> | null,
  includeDownloadUrls: boolean,
): Promise<ResolvedManifestEntry[]> {
  const tasks = rows.map(async (row) => {
    if (allowedIds && !allowedIds.has(row.id)) return null;

    const path = validateDestination(row.destination);
    if (!path.ok) return null;

    // Preview only needs to know the entry *could* be downloaded. Never put
    // storage_key or external_url into downloadUrl and then strip it — a
    // forgotten strip would leak the catalog.
    const hasSource =
      row.kind === "hosted" ? Boolean(row.storage_key) : Boolean(row.external_url);
    if (!hasSource) return null;

    const downloadUrl = includeDownloadUrls
      ? row.kind === "hosted"
        ? await signDownloadUrl(row.storage_key as string, row.label)
        : (row.external_url as string)
      : "";

    return {
      id: row.id,
      label: row.label,
      destination: path.destination,
      sizeBytes: Number(row.size_bytes),
      kind: row.kind,
      sha256: normalizeManifestSha256(row.sha256),
      optional: row.is_optional || undefined,
      group: row.group_name ?? undefined,
      downloadUrl,
    } as ResolvedManifestEntry;
  });

  const resolved = await Promise.all(tasks);
  const entries: ResolvedManifestEntry[] = [];
  for (const entry of resolved) {
    if (entry) entries.push(entry);
  }
  return entries;
}

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
            access.error ??
            (access.status === 403
              ? "Assinatura ativa necessária para baixar este catálogo."
              : access.status === 503
                ? "Servidor temporariamente indisponível. Tente novamente em instantes."
                : "Faça login ou abra o catálogo pelo site com sua conta."),
        },
        { status: access.status },
      );
    }

    if (access.userId) {
      const userLimited = await enforceRateLimit(
        request,
        "manifest",
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

    let entries: ResolvedManifestEntry[];
    try {
      entries = await resolveManifestEntries(
        rows ?? [],
        allowedIds,
        access.includeDownloadUrls,
      );
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

    const base = {
      version: MANIFEST_VERSION,
      portfolio: {
        slug: portfolio.slug,
        title: portfolio.title,
        description: portfolio.description,
        updatedAt: portfolio.updated_at,
      },
      totalBytes: entries.reduce((sum, entry) => sum + entry.sizeBytes, 0),
      expiresAt: new Date(Date.now() + downloadUrlTtl() * 1000).toISOString(),
    } as const;

    const manifest: Manifest | ManifestPreview = access.includeDownloadUrls
      ? { ...base, entries }
      : { ...base, entries: omitDownloadUrls(entries) };

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
