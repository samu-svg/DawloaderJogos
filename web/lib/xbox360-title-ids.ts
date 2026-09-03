import bundled from "@/lib/xbox360-title-ids.json";

const TITLE_ID = /^[0-9A-Fa-f]{8}$/;
const ALL_ZEROS = /^0+$/;

export type TitleIdMap = Record<string, string>;

export function xbox360TitleIdMap(): TitleIdMap {
  return { ...bundled };
}

export function titleIdFromDestination(destination: string): string | null {
  const segments = destination.replace(/\\/g, "/").split("/").filter(Boolean);
  const rest = segments.slice(1);
  const found = rest.find((segment) => TITLE_ID.test(segment) && !ALL_ZEROS.test(segment));
  return found ? found.toUpperCase() : null;
}

/** Completa o mapa com jogos do catálogo (não usa rótulo de DLC). */
export function mergeCatalogTitleIds(
  base: TitleIdMap,
  entries: { destination: string; label: string; group?: string }[],
): TitleIdMap {
  const next = { ...base };
  for (const entry of entries) {
    if ((entry.group ?? "").toLowerCase() === "conteudo") continue;
    const id = titleIdFromDestination(entry.destination);
    if (!id || next[id]) continue;
    const label = entry.label.trim();
    if (!label || TITLE_ID.test(label) || /^DLC\s+/i.test(label)) continue;
    next[id] = label;
  }
  return next;
}
