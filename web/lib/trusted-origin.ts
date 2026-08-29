/** Aceita POST de auth só da origem deste site (defesa extra contra CSRF). */
export function isTrustedAuthOrigin(request: Request): boolean {
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const raw = originHeader || refererHeader;
  if (!raw) return true;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  if (host && parsed.host === host) return true;

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) {
    try {
      if (parsed.origin === new URL(site).origin) return true;
    } catch {
      return false;
    }
  }

  return false;
}
