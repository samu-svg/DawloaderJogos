const SPECIAL_INSTALL_PREFIX = "special-";

export function isSpecialInstallSlug(slug: string): boolean {
  return slug.startsWith(SPECIAL_INSTALL_PREFIX);
}

export function packSlugFromInstallSlug(installSlug: string): string | null {
  if (!isSpecialInstallSlug(installSlug)) return null;
  const packSlug = installSlug.slice(SPECIAL_INSTALL_PREFIX.length).trim();
  return packSlug || null;
}

/** Utilitários com marcadores conhecidos na raiz do HD. */
export const SPECIAL_HD_MARKERS: Record<string, readonly string[]> = {
  abadavatar: [
    "Pack -AbadAvatar V1.3 + AutoStart Imediato.rar",
    "AbadAvatar",
    "BadUpdate",
  ],
};

export function hdMarkersForEntry(entryId: string): readonly string[] {
  return SPECIAL_HD_MARKERS[entryId] ?? [];
}

export function isDeliverableArchiveDestination(destination: string): boolean {
  const base = destination.replace(/\\/g, "/").split("/").pop() ?? "";
  return /\.(rar|7z)$/i.test(base);
}

/** IDs de utilitários que o app pula automaticamente se já estiverem no HD. */
export const AUTO_SKIP_UTILITY_IDS = new Set(["abadavatar"]);
