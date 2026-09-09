import { getPublicPortfolio } from "@/lib/catalog";
import {
  entriesBelongToSingleGame,
  groupCatalogGames,
} from "@/lib/catalog-shared";
import {
  getSpecialDownload,
  isSpecialInstallSlug,
  packSlugFromInstallSlug,
} from "@/lib/special-downloads";

export async function isSingleGameInstall(
  slug: string,
  entryIds: readonly string[],
): Promise<boolean> {
  if (entryIds.length === 0) return false;

  if (isSpecialInstallSlug(slug)) {
    const packSlug = packSlugFromInstallSlug(slug);
    const pack = packSlug ? getSpecialDownload(packSlug) : null;
    if (!pack) return false;
    return entryIds.every((id) => id === pack.entryId);
  }

  const catalog = await getPublicPortfolio(slug);
  if (!catalog) return false;
  return entriesBelongToSingleGame(
    groupCatalogGames(catalog.entries),
    entryIds,
  );
}
