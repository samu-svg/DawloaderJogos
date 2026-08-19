/** Link profundo para abrir o app MontaHD com catálogo pré-preenchido. */
export function buildMontaHDCatalogLink(
  siteUrl: string,
  slug: string,
  entryIds: string[] = [],
  manifestToken?: string | null,
): string {
  const base = siteUrl.trim().replace(/\/+$/, "");
  const params = new URLSearchParams({
    url: base,
    slug: slug.trim(),
  });

  if (entryIds.length > 0) {
    params.set("entries", entryIds.join(","));
  }

  if (manifestToken) {
    params.set("token", manifestToken);
  }

  return `montahd://open?${params.toString()}`;
}

export function parseMontaHDEntryIds(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}
