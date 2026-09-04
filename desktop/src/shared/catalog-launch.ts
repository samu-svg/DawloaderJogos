export type CatalogLaunch = {
  baseUrl: string;
  slug: string;
  entryIds: string[];
  installSession: string | null;
  manifestToken: string | null;
};

export const DEFAULT_SITE_URL = "https://montahds.app";
export const PRODUCTION_SITE_ORIGIN = "https://montahds.app";

export type CatalogOriginOptions = {
  allowLocalhost?: boolean;
};

/**
 * Hosts exatos do domínio próprio. Prefixo em `.vercel.app` é namespace
 * público: qualquer conta cria `montahd-oficial.vercel.app` e o app
 * trataria como catálogo nosso. Preview e alias da Vercel não entram —
 * desenvolvimento usa `allowLocalhost`.
 */
const TRUSTED_CATALOG_HOSTS = new Set(["montahds.app", "www.montahds.app"]);

function isLocalhostHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

export function isTrustedCatalogHost(hostname: string): boolean {
  return TRUSTED_CATALOG_HOSTS.has(hostname.toLowerCase());
}

export function isAllowedCatalogOrigin(
  input: string,
  options: CatalogOriginOptions = {},
): boolean {
  try {
    const parsed = new URL(input);
    if (isTrustedCatalogHost(parsed.hostname)) {
      return parsed.protocol === "https:";
    }
    if (options.allowLocalhost && isLocalhostHost(parsed.hostname)) {
      return parsed.protocol === "http:" || parsed.protocol === "https:";
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

export function stripArgQuotes(arg: string): string {
  const trimmed = arg.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function canonicalizeCatalogBaseUrl(input: string): string {
  const raw = input.trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (isLocalhostHost(parsed.hostname)) {
      return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
    }
    const host = parsed.hostname.toLowerCase();
    if (host === "www.montahds.app" || host === "montahds.app") {
      return PRODUCTION_SITE_ORIGIN;
    }
  } catch {
    // ignora e devolve o valor original
  }
  return raw;
}

function parseInstallPathLaunch(
  url: URL,
  options: CatalogOriginOptions,
): CatalogLaunch | null {
  const pathParts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  let slug: string | null = null;
  let installSession: string | null = null;

  if (url.hostname.toLowerCase() === "install") {
    slug = pathParts[0] ? decodeURIComponent(pathParts[0]) : null;
    installSession = pathParts[1] ? decodeURIComponent(pathParts[1]) : null;
  } else if (pathParts[0]?.toLowerCase() === "install") {
    slug = pathParts[1] ? decodeURIComponent(pathParts[1]) : null;
    installSession = pathParts[2] ? decodeURIComponent(pathParts[2]) : null;
  }

  if (!slug) return null;

  const rawBaseUrl = url.searchParams.get("url")?.trim();
  const baseUrl = canonicalizeCatalogBaseUrl(rawBaseUrl || PRODUCTION_SITE_ORIGIN);
  if (!isAllowedCatalogOrigin(baseUrl, options)) return null;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    slug,
    entryIds: parseEntryIds(url.searchParams.get("entries")),
    installSession,
    manifestToken: url.searchParams.get("token")?.trim() || null,
  };
}

export function parseMontaHDDeepLink(
  rawUrl: string,
  options: CatalogOriginOptions = {},
): CatalogLaunch | null {
  try {
    const url = new URL(stripArgQuotes(rawUrl).trim());
    if (url.protocol.toLowerCase() !== "montahd:") return null;

    const installLaunch = parseInstallPathLaunch(url, options);
    if (installLaunch) return installLaunch;

    const rawBaseUrl = url.searchParams.get("url")?.trim();
    const slugFromQuery = url.searchParams.get("slug")?.trim();
    const slugFromPath = url.pathname
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.trim();

    const slug = slugFromQuery || slugFromPath;
    if (!rawBaseUrl || !slug) return null;

    const baseUrl = canonicalizeCatalogBaseUrl(rawBaseUrl);
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

const DEEP_LINK_QUERY_KEY = /^(url|slug|session|entries|token)=/i;

/**
 * Windows parte `montahd://open?a=1&b=2` em vários argv quando o handler
 * não coloca aspas em `%1`. Recoloca os pedaços `chave=valor`.
 */
function collectDeepLinkPieces(args: string[], start: number): string[] {
  const pieces = [args[start]!];
  for (let i = start + 1; i < args.length; i += 1) {
    const arg = args[i] ?? "";
    const candidate = arg.startsWith("&") ? arg.slice(1) : arg;
    if (!DEEP_LINK_QUERY_KEY.test(candidate)) break;
    pieces.push(candidate);
  }
  return pieces;
}

export function findDeepLinkInArgv(argv: string[]): string | null {
  const args = argv.map(stripArgQuotes);
  const start = args.findIndex((arg) => /^montahd:/i.test(arg));
  if (start < 0) return null;

  const pieces = collectDeepLinkPieces(args, start);
  const primary = pieces.length === 1 ? pieces[0]! : `${pieces[0]}&${pieces.slice(1).join("&")}`;

  if (parseMontaHDDeepLink(primary)) return primary;

  // Legado: slug/session em argv separados quando o handler cortou no primeiro &.
  const extras = args
    .slice(start + pieces.length)
    .map((arg) => (arg.startsWith("&") ? arg.slice(1) : arg))
    .filter((arg) => DEEP_LINK_QUERY_KEY.test(arg));

  if (extras.length === 0) return primary;

  const legacy = `${pieces[0]}&${[...pieces.slice(1), ...extras].join("&")}`;
  return parseMontaHDDeepLink(legacy) ? legacy : primary;
}

export function entryIdsFromLaunch(launch: CatalogLaunch): string[] | null {
  return launch.entryIds.length ? launch.entryIds : null;
}
