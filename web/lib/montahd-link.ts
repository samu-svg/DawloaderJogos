/** Link profundo para abrir o app MontaHD com catálogo pré-preenchido. */
export function buildMontaHDCatalogLink(
  siteUrl: string,
  slug: string,
  entryIds: string[] = [],
  options?: {
    installSession?: string | null;
  },
): string {
  const base = siteUrl.trim().replace(/\/+$/, "");
  const params = new URLSearchParams({
    url: base,
    slug: slug.trim(),
  });

  const installSession = options?.installSession?.trim();

  // Com sessão, o manifesto vem filtrado no servidor — evita URL enorme.
  // Tokens HMAC antigos não entram mais na query (ficavam no histórico/logs).
  if (entryIds.length > 0 && !installSession) {
    params.set("entries", entryIds.join(","));
  }

  if (installSession) {
    params.set("session", installSession);
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
