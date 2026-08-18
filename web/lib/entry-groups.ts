import type { EntryRow } from "@/lib/database.types";

export type EntryGroup = {
  main: EntryRow;
  extras: EntryRow[];
};

/** Agrupa entries de um portfólio: jogo principal + DLC/conteúdo opcional logo abaixo. */
export function groupPortfolioEntries(entries: EntryRow[]): EntryGroup[] {
  const groups: EntryGroup[] = [];
  let current: EntryGroup | null = null;

  for (const entry of entries) {
    if (entry.group_name === "jogo") {
      current = { main: entry, extras: [] };
      groups.push(current);
      continue;
    }

    if (entry.group_name === "conteudo" && current) {
      current.extras.push(entry);
      continue;
    }

    current = { main: entry, extras: [] };
    groups.push(current);
  }

  return groups;
}

export function entryIdsInGroup(
  entries: Pick<EntryRow, "id" | "group_name" | "sort_order">[],
  mainEntryId: string,
): string[] {
  const sorted = [...entries].sort((a, b) => a.sort_order - b.sort_order);
  const mainIndex = sorted.findIndex((entry) => entry.id === mainEntryId);
  if (mainIndex === -1) return [];

  const ids = [mainEntryId];
  for (let index = mainIndex + 1; index < sorted.length; index += 1) {
    if (sorted[index].group_name === "conteudo") {
      ids.push(sorted[index].id);
    } else {
      break;
    }
  }

  return ids;
}
