export type CatalogLaunch = {
  baseUrl: string;
  slug: string;
  entryIds: string[];
  installSession: string | null;
  manifestToken: string | null;
};

export const DEFAULT_SITE_URL = "https://montahd.vercel.app";
export const PRODUCTION_SITE_ORIGIN = "https://montahd.vercel.app";

export type CatalogOriginOptions = {
  allowLocalhost?: boolean;
};

function isLocalhostHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

export function isAllowedCatalogOrigin(
  input: string,
  options: CatalogOriginOptions = {},
): boolean {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    if (parsed.origin === PRODUCTION_SITE_ORIGIN) return true;
    if (options.allowLocalhost && isLocalhostHost(parsed.hostname)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** URL do site usada pelo app; só produção, e localhost se `allowLocalhost`. */
export function normalizeSiteUrl(
  input: string | null | undefined,
  options: CatalogOriginOptions = {},
): string {
  const raw = (input?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, "");
  if (isAllowedCatalogOrigin(raw, options)) return raw;
  return DEFAULT_SITE_URL;
}

export function requireAllowedCatalogOrigin(
  input: string,
  options: CatalogOriginOptions = {},
): string {
  const raw = input.trim().replace(/\/+$/, "");
  if (!isAllowedCatalogOrigin(raw, options)) {
    throw new Error("Origem do catálogo não permitida.");
  }
  return raw;
}

function parseEntryIds(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function parseMontaHDDeepLink(
  rawUrl: string,
  options: CatalogOriginOptions = {},
): CatalogLaunch | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "montahd:") return null;

    const baseUrl = url.searchParams.get("url")?.trim();
    const slugFromQuery = url.searchParams.get("slug")?.trim();
    const slugFromPath = url.pathname
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.trim();

    const slug = slugFromQuery || slugFromPath;
    if (!baseUrl || !slug) return null;
    if (!isAllowedCatalogOrigin(baseUrl, options)) return null;

    return {
      baseUrl: baseUrl.replace(/\/+$/, ""),
      slug,
      entryIds: parseEntryIds(url.searchParams.get("entries")),
      installSession: url.searchParams.get("session")?.trim() || null,
      manifestToken: url.searchParams.get("token")?.trim() || null,
    };
  } catch {
    return null;
  }
}

export function findDeepLinkInArgv(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith("montahd://")) ?? null;
}

export function entryIdsFromLaunch(launch: CatalogLaunch): string[] | null {
  return launch.entryIds.length ? launch.entryIds : null;
}
