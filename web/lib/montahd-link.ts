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

  // Com token, o manifesto já vem filtrado no servidor — evita URL enorme e truncamento.
  if (entryIds.length > 0 && !manifestToken) {
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
