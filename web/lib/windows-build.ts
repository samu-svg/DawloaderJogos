export type DesktopBuildId =
  | "win10-x64"
  | "win10-ia32"
  | "win7-x64"
  | "win7-ia32";

/**
 * Palpite a partir do User-Agent. WOW64 = navegador 32-bit num Windows 64-bit
 * → recomendamos a build 64-bit. Sempre deixe o usuário trocar na mão.
 */
export function detectWindowsBuildId(
  userAgent: string,
  platform = "",
): DesktopBuildId {
  const haystack = `${userAgent} ${platform}`;
  const isLegacy = /Windows NT 6\.[123]/i.test(haystack);
  const is64 = /Win64|WOW64|x64|amd64/i.test(haystack);

  if (isLegacy) return is64 ? "win7-x64" : "win7-ia32";
  return is64 ? "win10-x64" : "win10-ia32";
}

export function detectWindowsBuildIdFromNavigator(): DesktopBuildId {
  if (typeof navigator === "undefined") return "win10-x64";
  return detectWindowsBuildId(navigator.userAgent, navigator.platform ?? "");
}
