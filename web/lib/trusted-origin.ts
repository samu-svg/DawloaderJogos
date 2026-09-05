/** Aceita POST de auth só da origem deste site (defesa extra contra CSRF). */

function canonicalHost(host: string): string {
  return host.replace(/:\d+$/, "").replace(/^www\./i, "").toLowerCase();
}

function hostnameOf(originOrUrl: string): string | null {
  try {
    return new URL(originOrUrl).hostname;
  } catch {
    return null;
  }
}

export function isTrustedAuthOrigin(
  request: Request,
  options?: { requireOrigin?: boolean },
): boolean {
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const raw = originHeader || refererHeader;
  const requireOrigin =
    options?.requireOrigin ?? process.env.NODE_ENV === "production";
  if (!raw) return !requireOrigin;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  if (host && canonicalHost(parsed.hostname) === canonicalHost(host)) return true;

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) {
    const siteHost = hostnameOf(site);
    if (siteHost && canonicalHost(parsed.hostname) === canonicalHost(siteHost)) {
      return true;
    }
  }

  return false;
}
