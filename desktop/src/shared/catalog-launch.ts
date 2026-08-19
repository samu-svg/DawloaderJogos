export type CatalogLaunch = {
  baseUrl: string;
  slug: string;
  entryIds: string[];
  manifestToken: string | null;
};

function parseEntryIds(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function parseMontaHDDeepLink(rawUrl: string): CatalogLaunch | null {
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

    return {
      baseUrl: baseUrl.replace(/\/+$/, ""),
      slug,
      entryIds: parseEntryIds(url.searchParams.get("entries")),
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
