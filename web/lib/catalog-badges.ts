import { gamePageMeta, type GameAudio } from "@/lib/game-pages";

export type CatalogBadge = {
  kind: "audio" | "dlc";
  label: string;
  tone: "pt-br" | "dublado" | "dlc";
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
    return { kind: "audio", label: "PT-BR", tone: "pt-br" };
  }
  return null;
}

export function catalogBadgesForGame(
  entryId: string,
  extraCount: number,
): CatalogBadge[] {
  const meta = gamePageMeta(entryId);
  const badges: CatalogBadge[] = [];

  const audio = audioCatalogBadge(meta?.audio);
  if (audio) badges.push(audio);

  const dlcFromNotes = (meta?.dlcNotes?.length ?? 0) > 0;
  if (extraCount > 0) {
    badges.push({
      kind: "dlc",
      label: extraCount === 1 ? "+1 DLC" : `+${extraCount} DLC`,
      tone: "dlc",
    });
  } else if (dlcFromNotes) {
    badges.push({ kind: "dlc", label: "Com DLC", tone: "dlc" });
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
    suffixes.push("PT-BR");
  }

  const dlcFromNotes = (meta?.dlcNotes?.length ?? 0) > 0;
  if (extraCount > 0 && !titleAlreadyHas(title, "dlc")) {
    suffixes.push(extraCount === 1 ? "1 DLC" : `${extraCount} DLC`);
  } else if (dlcFromNotes && !titleAlreadyHas(title, "dlc")) {
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

export function resolveCoverUrl(
  entryId: string,
  coverUrl: string | null,
  localCoverUrl: (id: string) => string | null,
): string | null {
  return localCoverUrl(entryId) ?? coverUrl;
}
