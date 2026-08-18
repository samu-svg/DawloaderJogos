/** Link profundo para abrir o app Dawloader com catálogo pré-preenchido. */
export function buildDawloaderCatalogLink(
  siteUrl: string,
  slug: string,
  entryIds: string[] = [],
): string {
  const base = siteUrl.trim().replace(/\/+$/, "");
  const params = new URLSearchParams({
    url: base,
    slug: slug.trim(),
  });

  if (entryIds.length > 0) {
    params.set("entries", entryIds.join(","));
  }

  return `dawloader://open?${params.toString()}`;
}

export function parseDawloaderEntryIds(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}
