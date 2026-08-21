import {
  gameIdPrefixFromSlug,
  gameSlug,
  groupCatalogGames,
  platformLabel,
  type CatalogGameExtra,
} from "@/lib/catalog-shared";
import { listPublicCatalogs } from "@/lib/catalog";

export type AcervoGame = {
  id: string;
  slug: string;
  label: string;
  coverUrl: string | null;
  sizeBytes: number;
  totalBytes: number;
  extraCount: number;
  extras: CatalogGameExtra[];
  entryIds: string[];
  destination: string | null;
  collectionSlug: string;
  collectionTitle: string;
  platform: string;
  updatedAt: string;
};

export type AcervoCollection = {
  slug: string;
  title: string;
  description: string | null;
  gameCount: number;
};

type Acervo = {
  games: AcervoGame[];
  collections: AcervoCollection[];
};

export async function loadAcervo(): Promise<Acervo> {
  const catalogs = await listPublicCatalogs();
  const games: AcervoGame[] = [];
  const collections: AcervoCollection[] = [];

  for (const catalog of catalogs) {
    const grouped = groupCatalogGames(catalog.entries);
    const platform = platformLabel(catalog.title, catalog.slug);

    for (const game of grouped) {
      const entry = catalog.entries.find((item) => item.id === game.id);
      games.push({
        id: game.id,
        slug: gameSlug(game.label, game.id),
        label: game.label,
        coverUrl: game.coverUrl,
        sizeBytes: game.sizeBytes,
        totalBytes: game.totalBytes,
        extraCount: game.extraCount,
        extras: game.extras,
        entryIds: game.entryIds,
        destination: entry?.destination ?? null,
        collectionSlug: catalog.slug,
        collectionTitle: catalog.title,
        platform,
        updatedAt: catalog.updatedAt,
      });
    }

    if (grouped.length > 0) {
      collections.push({
        slug: catalog.slug,
        title: catalog.title,
        description: catalog.description,
        gameCount: grouped.length,
      });
    }
  }

  return { games, collections };
}

export async function findAcervoGame(slug: string): Promise<AcervoGame | null> {
  const { games } = await loadAcervo();
  const exact = games.find((game) => game.slug === slug);
  if (exact) return exact;

  const prefix = gameIdPrefixFromSlug(slug);
  if (!prefix) return null;
  return games.find((game) => game.id.toLowerCase().startsWith(prefix)) ?? null;
}

export async function relatedAcervoGames(
  game: AcervoGame,
  limit = 6,
): Promise<AcervoGame[]> {
  const { games } = await loadAcervo();
  return games
    .filter(
      (item) =>
        item.id !== game.id && item.collectionSlug === game.collectionSlug,
    )
    .slice(0, limit);
}
