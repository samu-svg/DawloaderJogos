import pages from "@/content/xbox360-game-pages.json";

import localCovers from "@/content/local-covers.json";

export type GameAudio = "dublado" | "pt-br" | "ingles" | "desconhecido";

export type GamePageMeta = {
  displayTitle?: string;
  description: string;
  /** Sinopse completa exibida na página do jogo (além do resumo curto). */
  longDescription?: string;
  audio: GameAudio;
  audioNote?: string;
  installHint?: "games" | "content";
  dlcNotes?: string[];
  /** Força badge de DLC no card quando o extra não está agrupado por sort_order. */
  hasDlc?: boolean;
  /** Notas técnicas extras (discos, Title ID, etc.) quando não couberem nos outros campos. */
  technicalNotes?: string[];
};

export type CatalogExtra = {
  label: string;
  sizeBytes: number;
  destination: string;
};

export function hasPackageDetails(
  meta: GamePageMeta | null,
  extras: CatalogExtra[],
  destination: string | null,
  totalBytes: number,
  sizeBytes: number,
): boolean {
  if (extras.length > 0) return true;
  if (destination) return true;
  if (totalBytes > sizeBytes) return true;
  if (!meta) return false;
  return Boolean(
    meta.audioNote ||
      meta.dlcNotes?.length ||
      meta.technicalNotes?.length ||
      meta.installHint,
  );
}

const PAGE_MAP = pages as Record<string, GamePageMeta>;

/** Capas locais (SSD / import manual) têm prioridade sobre URLs externas imprecisas. */
const LOCAL_COVERS: Record<string, string> = {
  ...(localCovers as Record<string, string>),
  "764c602c-1b14-4244-a613-19fbdc176e84": "/covers/mario-64.png",
};

export function gamePageMeta(entryId: string): GamePageMeta | null {
  return PAGE_MAP[entryId] ?? null;
}

export function localCoverUrl(entryId: string): string | null {
  return LOCAL_COVERS[entryId] ?? null;
}

export function audioLabel(audio: GameAudio): string {
  switch (audio) {
    case "dublado":
      return "Dublado (PT-BR)";
    case "pt-br":
      return "PT-BR";
    case "ingles":
      return "Inglês";
    default:
      return "Não confirmado";
  }
}

export function installFolderKind(
  destination: string | null,
  hint?: "games" | "content",
): { label: string; detail: string } {
  if (hint === "content" || destination?.replace(/\\/g, "/").startsWith("Content/")) {
    return {
      label: "Content (XBLA / DLC)",
      detail:
        "Vai para Content/0000000000000000/{TitleID} no HD, não para a pasta Games.",
    };
  }
  return {
    label: "Games",
    detail: "Jogo extraído em Games/{pasta} no HD.",
  };
}
