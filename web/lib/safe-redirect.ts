/** Só permite caminhos relativos internos — bloqueia `//evil.com`. */
export function safeInternalPath(
  next: string | null | undefined,
  fallback = "/baixar",
): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  if (next.includes("\\") || next.includes("@")) return fallback;

  try {
    const url = new URL(next, "https://montahd.invalid");
    if (url.origin !== "https://montahd.invalid") return fallback;
    if (url.username || url.password) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
