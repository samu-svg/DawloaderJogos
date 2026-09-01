/**
 * Signed download URLs work for anyone who holds them, so they leave the
 * server only when the caller proved an HD binding (desktop Bearer flow) or
 * the catalog is deliberately open. A browser cookie — including admin —
 * never receives them: otherwise a logged-in session can copy the JSON and
 * hand the whole catalog to people with no account.
 */
export function includeManifestDownloadUrls(
  source: "bearer" | "cookie" | "open-catalog",
): boolean {
  return source !== "cookie";
}
