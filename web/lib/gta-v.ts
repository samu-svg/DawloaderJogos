export type GtaSortableGame = {
  label: string;
  displayTitle?: string;
};

/** GTA V / GTA 5 — não San Andreas. */
export function isGtaVGame(game: GtaSortableGame): boolean {
  const texts = [game.label, game.displayTitle].filter(
    (text): text is string => Boolean(text?.trim()),
  );

  for (const text of texts) {
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
