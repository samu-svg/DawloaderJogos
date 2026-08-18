import { createClient, createPublicReaderClient } from "@/lib/supabase/server";

export type CatalogPortfolio = {
  slug: string;
  title: string;
  description: string | null;
  updatedAt: string;
  entryCount: number;
};

export type CatalogEntry = {
  id: string;
  label: string;
  destination: string;
  sizeBytes: number;
  optional: boolean;
  group: string | null;
  coverUrl: string | null;
};

export type CatalogPortfolioDetail = CatalogPortfolio & {
  entries: CatalogEntry[];
};

export function groupLabel(group: string | null): string | null {
  if (group === "jogo") return "Jogo";
  if (group === "conteudo") return "DLC / Content";
  return group;
}

export async function listPublicPortfolios(): Promise<CatalogPortfolio[]> {
  const supabase = await createPublicReaderClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select("slug, title, description, updated_at, entries(count)")
    .eq("is_public", true)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    slug: row.slug,
    title: row.title,
    description: row.description,
    updatedAt: row.updated_at,
    entryCount: row.entries?.[0]?.count ?? 0,
  }));
}

export async function getPublicPortfolio(
  slug: string,
): Promise<CatalogPortfolioDetail | null> {
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

  const entries = [...(data.entries ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  return {
    slug: data.slug,
    title: data.title,
    description: data.description,
    updatedAt: data.updated_at,
    entryCount: entries.length,
    entries: entries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      destination: entry.destination,
      sizeBytes: entry.size_bytes,
      optional: entry.is_optional,
      group: entry.group_name,
      coverUrl: entry.cover_url,
    })),
  };
}

/** Confirma que o portfólio pertence ao usuário logado. */
export async function requireOwnedPortfolio(slug: string, ownerId: string) {
  const supabase = await createClient();
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id, slug")
    .eq("slug", slug)
    .eq("owner_id", ownerId)
    .maybeSingle();

  return portfolio;
}
