export type CatalogPortfolio = {
  slug: string;
  title: string;
  description: string | null;
  updatedAt: string;
  entryCount: number;
};

export type CatalogEntry = {
  id: string;
  label: string;
  destination: string;
  sizeBytes: number;
  optional: boolean;
  group: string | null;
  coverUrl: string | null;
};

export type CatalogPortfolioDetail = CatalogPortfolio & {
  entries: CatalogEntry[];
};

export type CatalogGameExtra = {
  id: string;
  label: string;
  destination: string;
  sizeBytes: number;
};

export type CatalogGame = {
  id: string;
  label: string;
  coverUrl: string | null;
  sizeBytes: number;
  optional: boolean;
  extraCount: number;
  totalBytes: number;
  /** IDs de manifesto (jogo + extras vinculados). */
  entryIds: string[];
  extras: CatalogGameExtra[];
};

export function groupCatalogGames(entries: CatalogEntry[]): CatalogGame[] {
  const groups: CatalogGame[] = [];
  let current: CatalogGame | null = null;

  for (const entry of entries) {
    if (entry.group === "jogo") {
      current = {
        id: entry.id,
        label: entry.label,
        coverUrl: entry.coverUrl,
        sizeBytes: entry.sizeBytes,
        optional: entry.optional,
        extraCount: 0,
        totalBytes: entry.sizeBytes,
        entryIds: [entry.id],
        extras: [],
      };
      groups.push(current);
      continue;
    }

    if (entry.group === "conteudo" && current) {
      current.extraCount += 1;
      current.totalBytes += entry.sizeBytes;
      current.entryIds.push(entry.id);
      current.extras.push({
        id: entry.id,
        label: entry.label,
        destination: entry.destination,
        sizeBytes: entry.sizeBytes,
      });
      continue;
    }

    current = {
      id: entry.id,
      label: entry.label,
      coverUrl: entry.coverUrl,
      sizeBytes: entry.sizeBytes,
      optional: entry.optional,
      extraCount: 0,
      totalBytes: entry.sizeBytes,
      entryIds: [entry.id],
      extras: [],
    };
    groups.push(current);
  }

  return groups;
}

export function entryIdsForSelectedGames(
  games: CatalogGame[],
  selectedGameIds: ReadonlySet<string>,
): string[] {
  const ids: string[] = [];
  for (const game of games) {
    if (selectedGameIds.has(game.id)) {
      ids.push(...game.entryIds);
    }
  }
  return ids;
}

export function groupLabel(group: string | null): string | null {
  if (group === "jogo") return "Jogo";
  if (group === "conteudo") return "DLC / Content";
  return group;
}

/** Quantos caracteres do id entram na URL do jogo. */
const SLUG_ID_LENGTH = 8;

export function slugifyTitle(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function gameSlug(label: string, id: string): string {
  const base = slugifyTitle(label) || "jogo";
  return `${base}-${id.slice(0, SLUG_ID_LENGTH)}`;
}

export function gameIdPrefixFromSlug(slug: string): string {
  return slug.split("-").at(-1)?.toLowerCase() ?? "";
}

/** Nome de plataforma exibido nos cards, derivado da coleção. */
export function platformLabel(
  collectionTitle: string,
  collectionSlug: string,
): string {
  const haystack = `${collectionTitle} ${collectionSlug}`.toLowerCase();
  if (haystack.includes("360")) return "Xbox 360";
  if (haystack.includes("xbox")) return "Xbox";
  if (haystack.includes("ps2")) return "PlayStation 2";
  if (haystack.includes("ps3")) return "PlayStation 3";
  if (haystack.includes("wii")) return "Wii";
  if (haystack.includes("pc")) return "PC";
  return collectionTitle;
}

export function gameInitialGroup(label: string): string {
  const first = slugifyTitle(label).charAt(0).toUpperCase();
  if (!first) return "#";
  return /[A-Z]/.test(first) ? first : "#";
}
