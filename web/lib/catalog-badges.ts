import { gamePageMeta, type GameAudio } from "@/lib/game-pages";
import { isWeeklyGame } from "@/lib/weekly-games";

export type CatalogBadge = {
  kind: "audio" | "dlc" | "weekly" | "utility" | "featured";
  label: string;
  tone: "pt-br" | "dublado" | "dlc" | "weekly" | "utility" | "featured";
};

function formatTitle(label: string): string {
  if (!label) return "Jogo";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function audioCatalogBadge(
  audio: GameAudio | undefined,
): CatalogBadge | null {
  if (audio === "dublado") {
    return { kind: "audio", label: "Dublado", tone: "dublado" };
  }
  if (audio === "pt-br") {
    return { kind: "audio", label: "Legendado PT-BR", tone: "pt-br" };
  }
  return null;
}

function hasMeaningfulDlcNotes(notes: string[] | undefined): boolean {
  if (!notes?.length) return false;
  return notes.some((note) => {
    const lower = note.toLowerCase();
    if (/^title id [0-9a-f]{8} — destino content/.test(lower)) return false;
    return /dlc|conteúdo opcional|disco \d|undead|multi-?disc|instale também|instale o disco|instale após/i.test(
      lower,
    );
  });
}

export function catalogBadgesForGame(
  entryId: string,
  extraCount: number,
): CatalogBadge[] {
  const meta = gamePageMeta(entryId);
  const badges: CatalogBadge[] = [];

  const audio = audioCatalogBadge(meta?.audio);
  if (audio) badges.push(audio);

  const dlcFromNotes = hasMeaningfulDlcNotes(meta?.dlcNotes);
  if (extraCount > 0) {
    badges.push({
      kind: "dlc",
      label: extraCount === 1 ? "+1 DLC" : `+${extraCount} DLC`,
      tone: "dlc",
    });
  } else if (meta?.hasDlc || dlcFromNotes) {
    badges.push({ kind: "dlc", label: "Com DLC", tone: "dlc" });
  }

  if (isWeeklyGame(entryId)) {
    badges.push({ kind: "weekly", label: "Semana", tone: "weekly" });
  }

  return badges;
}

function titleAlreadyHas(text: string, needle: string): boolean {
  return text.toLowerCase().includes(needle.toLowerCase());
}

/** Título enriquecido para cards — inclui PT-BR, dublagem e DLC quando relevante. */
export function catalogDisplayTitle(
  entryId: string,
  label: string,
  extraCount: number,
  options?: { forceSuffix?: boolean },
): string {
  const meta = gamePageMeta(entryId);
  let title = meta?.displayTitle ?? formatTitle(label);

  const suffixes: string[] = [];
  const audio = meta?.audio;

  if (audio === "dublado" && !titleAlreadyHas(title, "dublado")) {
    suffixes.push("Dublado");
  } else if (audio === "pt-br" && !titleAlreadyHas(title, "pt-br")) {
    suffixes.push("Legendado PT-BR");
  }

  const dlcFromNotes = hasMeaningfulDlcNotes(meta?.dlcNotes);
  if (extraCount > 0 && !titleAlreadyHas(title, "dlc")) {
    suffixes.push(extraCount === 1 ? "1 DLC" : `${extraCount} DLC`);
  } else if ((meta?.hasDlc || dlcFromNotes) && !titleAlreadyHas(title, "dlc")) {
    suffixes.push("Com DLC");
  }

  if (suffixes.length === 0) return title;
  if (options?.forceSuffix || !meta?.displayTitle) {
    return `${title} · ${suffixes.join(" · ")}`;
  }

  return suffixes.reduce((current, suffix) => {
    if (titleAlreadyHas(current, suffix)) return current;
    return `${current} · ${suffix}`;
  }, title);
}

/** Prefere capa local importada; senão usa a URL do catálogo (Xbox Marketplace, etc.). */
export function resolveCoverUrl(
  entryId: string,
  coverUrl: string | null,
  localCoverUrl: (id: string) => string | null,
): string | null {
  const local = localCoverUrl(entryId);
  if (local) return local;
  return coverUrl;
}
