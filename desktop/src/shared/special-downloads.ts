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

/** Instala primeiro na fila e grava na raiz do HD (não Games/Content). */
export const PRIORITY_ROOT_INSTALL_IDS = new Set(["abadavatar"]);

export function isPriorityRootInstall(entryId: string): boolean {
  return PRIORITY_ROOT_INSTALL_IDS.has(entryId);
}

/** Só o nome do arquivo, sem Games/ nem Content/. */
export function rootInstallFileName(destination: string): string {
  const segments = destination.replace(/\\/g, "/").split("/").filter(Boolean);
  return segments[segments.length - 1] ?? destination.trim();
}

export function destinationForPriorityRootInstall(
  entryId: string,
  destination: string,
): string {
  if (!isPriorityRootInstall(entryId)) return destination;
  return rootInstallFileName(destination);
}

export function orderPriorityRootInstallFirst<T>(
  items: T[],
  idOf: (item: T) => string,
): T[] {
  const priority: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (isPriorityRootInstall(idOf(item))) priority.push(item);
    else rest.push(item);
  }
  return [...priority, ...rest];
}

/** IDs de utilitários que o app pula automaticamente se já estiverem no HD. */
export const AUTO_SKIP_UTILITY_IDS = new Set<string>();
