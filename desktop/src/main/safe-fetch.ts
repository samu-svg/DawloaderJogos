import { assertSafeDownloadUrl } from "../shared/http-url";

const MAX_REDIRECTS = 5;

/** Fetch que só segue redirects para a mesma origem da URL inicial. */
export async function fetchSameOrigin(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const allowedOrigin = new URL(url).origin;
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current, { ...init, redirect: "manual" });
    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new Error("Redirect sem cabeçalho Location.");
    }

    const next = new URL(location, current);
    if (next.origin !== allowedOrigin) {
      throw new Error("Redirect para origem não permitida.");
    }

    current = next.toString();
    init = { ...init, body: undefined };
  }

  throw new Error("Muitos redirects na resposta.");
}

/**
 * Follows HTTP redirects but refuses hops to file/internal/metadata hosts.
 * Cross-origin public HTTPS is allowed so CDNs of external catalog entries still work.
 */
export async function fetchSafeRedirects(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  let current = assertSafeDownloadUrl(url).toString();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current, { ...init, redirect: "manual" });
    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new Error("Redirect sem cabeçalho Location.");
    }

    current = assertSafeDownloadUrl(new URL(location, current).toString()).toString();
    init = { ...init, body: undefined };
  }

  throw new Error("Muitos redirects na resposta.");
}
