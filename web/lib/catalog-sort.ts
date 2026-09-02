import { featuredRank } from "./featured-games.ts";
import { gamePageMeta } from "./game-pages.ts";

export type PopularSortableGame = {
  id: string;
  label: string;
  displayTitle?: string;
};

function sortTexts(game: PopularSortableGame): string[] {
  return [game.label, game.displayTitle].filter(
    (text): text is string => Boolean(text?.trim()),
  );
}

/** GTA V / GTA 5 — não San Andreas. */
export function isGtaVGame(game: PopularSortableGame): boolean {
  for (const text of sortTexts(game)) {
    const lower = text.toLowerCase();
    if (/san\s*andreas|\bandreas\b/.test(lower)) continue;
    if (
      /\bgrand theft auto\s*v\b/.test(lower) ||
      /\bgrand theft auto\s*5\b/.test(lower) ||
      /\bgta\s*v\b/.test(lower) ||
      /\bgta\s*5\b/.test(lower)
    ) {
      return true;
    }
  }
  return false;
}

/** 0 = dublado, 1 = pt-br/legendado, 2 = outro */
export function audioSortPriority(game: PopularSortableGame): number {
  const audio = gamePageMeta(game.id)?.audio;
  if (audio === "dublado") return 0;
  if (audio === "pt-br") return 1;

  for (const text of sortTexts(game)) {
    const lower = text.toLowerCase();
    if (lower.includes("dublado")) return 0;
    if (/pt-?br/.test(lower) || lower.includes("legendado")) return 1;
  }
  return 2;
}

/** Ordem padrão do catálogo: GTA V → dublado → PT-BR → populares → A–Z. */
export function comparePopularCatalogGames(
  a: PopularSortableGame,
  b: PopularSortableGame,
): number {
  const aGta = isGtaVGame(a);
  const bGta = isGtaVGame(b);
  if (aGta && !bGta) return -1;
  if (!aGta && bGta) return 1;

  const audioA = audioSortPriority(a);
  const audioB = audioSortPriority(b);
  if (audioA !== audioB) return audioA - audioB;

  const rankA = featuredRank(a.id) ?? 9999;
  const rankB = featuredRank(b.id) ?? 9999;
  if (rankA !== rankB) return rankA - rankB;

  const labelA = a.displayTitle ?? a.label;
  const labelB = b.displayTitle ?? b.label;
  return labelA.localeCompare(labelB, "pt-BR");
}
