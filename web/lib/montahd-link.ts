/** Link profundo para abrir o app MontaHD com catálogo pré-preenchido. */
export function buildMontaHDCatalogLink(
  siteUrl: string,
  slug: string,
  entryIds: string[] = [],
  options?: {
    installSession?: string | null;
    manifestToken?: string | null;
  },
): string {
  const base = siteUrl.trim().replace(/\/+$/, "");
  const params = new URLSearchParams({
    url: base,
    slug: slug.trim(),
  });

  const installSession = options?.installSession?.trim();
  const manifestToken = options?.manifestToken?.trim();

  // Com sessão ou token, o manifesto vem filtrado no servidor — evita URL enorme.
  if (entryIds.length > 0 && !installSession && !manifestToken) {
    params.set("entries", entryIds.join(","));
  }

  if (installSession) {
    params.set("session", installSession);
  } else if (manifestToken) {
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
