import {
  catalogBadgesForGame,
  catalogDisplayTitle,
  resolveCoverUrl,
} from "@/lib/catalog-badges";
import type { CatalogGameItem } from "@/components/game-catalog";
import { featuredRank } from "@/lib/featured-games";
import { gameCategoriesForEntry } from "@/lib/game-categories";
import { localCoverUrl } from "@/lib/game-pages";
import { isWeeklyGame } from "@/lib/weekly-games";
import type { AcervoGame } from "@/lib/games";

export function toCatalogGameItem(game: AcervoGame): CatalogGameItem {
  const displayTitle = catalogDisplayTitle(game.id, game.label, game.extraCount);
  return {
    id: game.id,
    slug: game.slug,
    label: game.label,
    displayTitle,
    coverUrl: resolveCoverUrl(game.id, game.coverUrl, localCoverUrl),
    sizeBytes: game.totalBytes,
    extraCount: game.extraCount,
    entryIds: game.entryIds,
    collectionSlug: game.collectionSlug,
    installCollectionSlug: game.installCollectionSlug ?? game.collectionSlug,
    collectionTitle: game.collectionTitle,
    platform: game.platform,
    badges: catalogBadgesForGame(game.id, game.extraCount, {
      isUtility: game.isUtility,
      pinned: game.pinned,
    }),
    featuredRank: featuredRank(game.id),
    categories: gameCategoriesForEntry(game.id, game.label, displayTitle),
    isWeekly: isWeeklyGame(game.id),
    pinned: game.pinned,
    isUtility: game.isUtility,
  };
}

export function toCatalogGameItems(games: AcervoGame[]): CatalogGameItem[] {
  return games.map(toCatalogGameItem);
}
