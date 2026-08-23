import {
  catalogBadgesForGame,
  catalogDisplayTitle,
  resolveCoverUrl,
} from "@/lib/catalog-badges";
import type { CatalogGameItem } from "@/components/game-catalog";
import { featuredRank } from "@/lib/featured-games";
import { localCoverUrl } from "@/lib/game-pages";
import type { AcervoGame } from "@/lib/games";

export function toCatalogGameItem(game: AcervoGame): CatalogGameItem {
  return {
    id: game.id,
    slug: game.slug,
    label: game.label,
    displayTitle: catalogDisplayTitle(game.id, game.label, game.extraCount),
    coverUrl: resolveCoverUrl(game.id, game.coverUrl, localCoverUrl),
    sizeBytes: game.totalBytes,
    extraCount: game.extraCount,
    collectionSlug: game.collectionSlug,
    collectionTitle: game.collectionTitle,
    platform: game.platform,
    badges: catalogBadgesForGame(game.id, game.extraCount),
    featuredRank: featuredRank(game.id),
  };
}

export function toCatalogGameItems(games: AcervoGame[]): CatalogGameItem[] {
  return games.map(toCatalogGameItem);
}
