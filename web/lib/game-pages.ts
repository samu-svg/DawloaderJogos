import pages from "@/content/xbox360-game-pages.json";

export type GameAudio = "dublado" | "pt-br" | "ingles" | "desconhecido";

export type GamePageMeta = {
  displayTitle?: string;
  description: string;
  audio: GameAudio;
  audioNote?: string;
  installHint?: "games" | "content";
  dlcNotes?: string[];
};

const PAGE_MAP = pages as Record<string, GamePageMeta>;

const LOCAL_COVERS: Record<string, string> = {
  "b78e07fc-5d14-450e-8f31-69c649f61563": "/covers/portal-still-alive.jpg",
  "1ba41a65-c189-4b1f-8043-68d7c9af2b39": "/covers/fifa-06.jpg",
  "c3dbe2a1-43e6-4910-bf40-f4af8a1c41be": "/covers/fifa-15.jpg",
  "5f202930-2e60-4d33-84dc-786bf6dbfd8b": "/covers/fifa-19.jpg",
  "d412001a-473c-406d-9bf1-1208060083c3": "/covers/pes-2018.png",
  "cb2e042f-a2c7-442a-a1b5-17ca59bd9f54": "/covers/pes-2010.jpg",
  "764c602c-1b14-4244-a613-19fbdc176e84": "/covers/mario-64.png",
  "d54271fe-7acf-4d92-b842-4d34eeaeeb2d": "/covers/ridge-racer-collection.jpg",
  "246f78c3-edc5-415b-956f-d118c17ebc99": "/covers/barbie-puppy-rescue.jpg",
  "52e06ece-ffcf-42b8-bd51-fd0fcaf94f5b": "/covers/spongebob-truth-or-square.jpg",
  "5185be31-d966-4c34-9e79-68266a1cd0bb": "/covers/hot-wheels.png",
  "6e66d037-ad3b-45cd-83c8-f075ca64f6b9": "/covers/sonic-unleashed.jpg",
  "99fe1ebf-b9ae-4105-8e00-0c41aa4f6497": "/covers/the-smurfs-2.jpg",
  "fd15402e-ff80-4168-9a12-561c2b24f690": "/covers/alice-madness-returns.jpg",
  "5edade5f-382c-4a10-893d-2bd7e95afb86": "/covers/tmnt-reshelled.png",
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
