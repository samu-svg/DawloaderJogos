import type { AppUser } from "@/lib/auth";
import type { EntryRow, PortfolioRow } from "@/lib/database.types";
import { canEditPortfolio } from "@/lib/rbac";
import { createClient, createPublicReaderClient } from "@/lib/supabase/server";

export type {
  CatalogEntry,
  CatalogGame,
  CatalogPortfolio,
  CatalogPortfolioDetail,
} from "@/lib/catalog-shared";
export {
  entryIdsForSelectedGames,
  groupCatalogGames,
  groupLabel,
} from "@/lib/catalog-shared";

export function toPortfolioRow(portfolio: PortfolioRow): PortfolioRow {
  return portfolio;
}

export function toEntryRow(entry: EntryRow): EntryRow {
  return entry;
}

function mapCatalogDetail(
  row: PortfolioRow & { entries: EntryRow[] | null },
): import("@/lib/catalog-shared").CatalogPortfolioDetail {
  const entries = [...(row.entries ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    updatedAt: row.updated_at,
    entryCount: entries.length,
    entries: entries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      destination: entry.destination,
      sizeBytes: Number(entry.size_bytes),
      optional: entry.is_optional,
      group: entry.group_name,
      coverUrl: entry.cover_url,
    })),
  };
}

export async function listPublicPortfolios(): Promise<
  import("@/lib/catalog-shared").CatalogPortfolio[]
> {
  const supabase = await createPublicReaderClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select("slug, title, description, updated_at, entries(id)")
    .eq("is_public", true)
    .order("updated_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => ({
    slug: row.slug,
    title: row.title,
    description: row.description,
    updatedAt: row.updated_at,
    entryCount: Array.isArray(row.entries) ? row.entries.length : 0,
  }));
}

export async function listPublicCatalogs(): Promise<
  import("@/lib/catalog-shared").CatalogPortfolioDetail[]
> {
  const supabase = await createPublicReaderClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select(
      "slug, title, description, updated_at, entries(id, label, destination, size_bytes, is_optional, group_name, cover_url, sort_order)",
    )
    .eq("is_public", true)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];

  return (data ?? []).map((row) =>
    mapCatalogDetail(row as PortfolioRow & { entries: EntryRow[] | null }),
  );
}

export async function getPublicPortfolio(
  slug: string,
): Promise<import("@/lib/catalog-shared").CatalogPortfolioDetail | null> {
  const supabase = await createPublicReaderClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select(
      "slug, title, description, updated_at, entries(id, label, destination, size_bytes, is_optional, group_name, cover_url, sort_order)",
    )
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (error || !data) return null;

  return mapCatalogDetail(data as PortfolioRow & { entries: EntryRow[] | null });
}

/** Portfólio editável apenas pelo dono com papel admin/editor. */
export async function requireEditablePortfolio(slug: string, user: AppUser) {
  if (!canEditPortfolio(user.role)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select("id, slug, owner_id")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  if (data.owner_id !== user.id) return null;
  return { id: data.id, slug: data.slug, ownerId: data.owner_id };
}

/** @deprecated use requireEditablePortfolio */
export async function requireOwnedPortfolio(slug: string, ownerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("portfolios")
    .select("id, slug")
    .eq("slug", slug)
    .eq("owner_id", ownerId)
    .maybeSingle();
  return data;
}
