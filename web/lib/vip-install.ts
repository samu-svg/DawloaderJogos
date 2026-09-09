import { getPublicPortfolio } from "./catalog.ts";
import { groupCatalogGames } from "./catalog-shared.ts";
import { gamePageMeta } from "./game-pages.ts";
import { isSpecialInstallSlug } from "./special-downloads.ts";
import { isVipGame, type VipGameRef } from "./vip-games.ts";

function gameRefForEntryId(
  entryId: string,
  catalog: NonNullable<Awaited<ReturnType<typeof getPublicPortfolio>>>,
): VipGameRef | null {
  const grouped = groupCatalogGames(catalog.entries);
  for (const game of grouped) {
    if (!game.entryIds.includes(entryId)) continue;
    const meta = gamePageMeta(game.id);
    return {
      id: game.id,
      label: game.label,
      displayTitle: meta?.displayTitle,
      audio: meta?.audio,
    };
  }

  const entry = catalog.entries.find((item) => item.id === entryId);
  if (!entry) return null;
  const meta = gamePageMeta(entry.id);
  return {
    id: entry.id,
    label: entry.label,
    displayTitle: meta?.displayTitle,
    audio: meta?.audio,
  };
}

export async function entryIdsRequireVip(
  slug: string,
  entryIds: readonly string[],
): Promise<boolean> {
  if (entryIds.length === 0) return false;
  if (isSpecialInstallSlug(slug)) return false;

  const catalog = await getPublicPortfolio(slug);
  if (!catalog) return false;

  for (const entryId of entryIds) {
    const ref = gameRefForEntryId(entryId, catalog);
    if (ref && isVipGame(ref)) return true;
  }

  return false;
}
