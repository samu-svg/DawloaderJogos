/** Link profundo para abrir o app MontaHD com catálogo pré-preenchido. */
export function canonicalCatalogSiteUrl(siteUrl: string): string {
  const raw = siteUrl.trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]"
    ) {
      return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
    }
  } catch {
    // usa produção
  }
  return "https://montahd.vercel.app";
}

/**
 * Link profundo sem `&` na query — o Windows corta o URL em handlers sem "%1" entre aspas.
 * Formato: montahd://install/{slug}/{session} ou montahd://install/{slug}?entries=…
 */
export function buildMontaHDCatalogLink(
  _siteUrl: string,
  slug: string,
  entryIds: string[] = [],
  options?: {
    installSession?: string | null;
  },
): string {
  const slugClean = encodeURIComponent(slug.trim());
  const installSession = options?.installSession?.trim();

  if (installSession) {
    return `montahd://install/${slugClean}/${encodeURIComponent(installSession)}`;
  }

  const params = new URLSearchParams();
  if (entryIds.length > 0) {
    params.set("entries", entryIds.join(","));
  }

  const query = params.toString();
  return query
    ? `montahd://install/${slugClean}?${query}`
    : `montahd://install/${slugClean}`;
}

export function parseMontaHDEntryIds(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}
