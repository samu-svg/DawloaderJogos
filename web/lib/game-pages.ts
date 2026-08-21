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
  "3f3c66d7-70ec-4a2d-9d01-ca328a84dff0": "/covers/pes-2014.jpg",
  "c5cf14dd-326c-4d84-8967-a9fdf2082323": "/covers/dragon-age-2.jpg",
  "c3effe68-85b7-4195-973a-485cef967863": "/covers/far-cry-2.jpg",
  "2820c254-3d69-4948-a074-6b17dd66b68b": "/covers/orange-box.jpg",
  "57a108e4-1a79-401c-8477-f2cb21a218b1": "/covers/life-is-strange.jpg",
  "bbbd64bc-ab71-4827-af80-fcb98b19c183": "/covers/mafia-2.jpg",
  "50404115-5961-4fb8-8314-64e2c37b949c": "/covers/asuras-wrath.jpg",
  "df92d381-515f-43c0-ad42-cc75164fb7a8": "/covers/dmc4.jpg",
  "e9f69fad-1824-4796-ac36-1efe7f6d57ba": "/covers/dmc-hd.jpg",
  "79faa2f3-ee5b-4832-aaca-294e5f93ccda": "/covers/dmc-dmc.jpg",
  "b75ed1ff-bf92-4e1c-9320-1746dd781002": "/covers/enslaved.jpg",
  "d9241d79-cac3-4ea5-9310-3a268e2ad358": "/covers/fifa-world-cup-2014.jpg",
  "5e4ed040-46c5-44d9-a197-32f131cd9823": "/covers/dirt-3.jpg",
  "d0195c32-9bb5-48d0-af1c-6a8eb15c2ac3": "/covers/fifa-street-3.jpg",
  "7640ad45-40d7-4cae-80b5-33db3ac23b78": "/covers/rumble-roses-xx.jpg",
  "d0c95662-1743-4a6b-93e9-17d2b63f9ed6": "/covers/saints-row-the-third.jpg",
  "8f29db94-f564-4f61-8b1b-0d6ec578c8bb": "/covers/skate-2.jpg",
  "0702f186-bb06-4a5e-851d-ad605163e147": "/covers/back-to-the-future.jpg",
  "477f0f06-f1d1-4a5b-88fe-df07974a5514": "/covers/bee-movie.jpg",
  "54d79674-fa72-49e1-a836-a8fc9138a6cc": "/covers/g-force.jpg",
  "269309c9-e77c-44ac-b3a1-b3c65ccb93fd": "/covers/harry-potter-ootp.jpg",
  "60fa9ace-ed97-429f-8180-47429ad0b25d": "/covers/terminator-salvation.jpg",
  "2972274c-8ff5-4ae5-9499-51d5432bc497": "/covers/narnia-prince-caspian.jpg",
  "090d0775-1047-4d72-8514-a4a5bd090387": "/covers/transformers-fall-of-cybertron.jpg",
  "ef873916-e26c-44ff-9c1b-d8187f315538": "/covers/dragon-ball-raging-blast.jpg",
  "586ba480-2894-4211-92a4-359a1a3c2e2e": "/covers/dragon-ball-raging-blast-2.jpg",
  "42d2f8f8-e7ba-4128-82a4-e20acea35a07": "/covers/dragon-ball-z-ultimate-tenkaichi.jpg",
  "9c6113be-30d3-428c-9afa-738f6b24f200": "/covers/dragon-ball-z-burst-limit.jpg",
  "4ef233c7-66e5-4376-b768-cf7f94f13c82": "/covers/dragon-ball-z-hd-collection.jpg",
  "c025ac83-ec12-4141-a0ae-efec96b28801": "/covers/baja-edge-of-control.jpg",
  "f9b7c88c-eb29-4bf2-9fca-5f9553fb5c06": "/covers/fight-night-round-4.jpg",
  "847b5032-0c7b-42da-8824-b87295e06f6a": "/covers/london-2012.jpg",
  "1add183b-1a23-46f9-b328-8f4b9d4a9539": "/covers/stoked-big-air.jpg",
  "5f217943-5a06-4ba5-b796-c6f285679da4": "/covers/top-spin-4.jpg",
  "6e8fde22-d682-45ef-a2ba-1789b232b3ef": "/covers/ufc-undisputed-3.jpg",
  "d80f6c03-e072-4cfe-9d44-1ca5037cdd0a": "/covers/call-of-duty-4.jpg",
  "3271e47f-3c82-4548-a7ac-74879e499dfe": "/covers/call-of-duty-black-ops.jpg",
  "48742df4-917c-4ca2-bf8d-81217142b6d2": "/covers/medal-of-honor-2010.jpg",
  "4235a623-3cd5-42bc-9825-5e82e652a028": "/covers/medal-of-honor-airborne.jpg",
  "76ed2aa2-1838-423a-98f2-a768396c477e": "/covers/metro-2033.jpg",
  "f73b47c6-f33a-40ee-b532-3cec198ec752": "/covers/brutal-legend.jpg",
  "6f6264fa-4acb-4df4-94fb-52c96d8f48fa": "/covers/dead-island.jpg",
  "e379928c-7260-43cc-86f6-707c276cdcd0": "/covers/hitman-blood-money.jpg",
  "06d1e7a2-cc2d-434b-aead-8b57d8c934f7": "/covers/star-wars-tfu-2.jpg",
  "da29129a-5f20-42cb-b1c6-4a0ff4791921": "/covers/star-wars-tfu-sith.jpg",
  "9a924ed9-2d51-49f9-97b0-338b58c23411": "/covers/titanfall.jpg",
  "0403964f-a497-467a-9fcd-81b9ab127409": "/covers/turok.jpg",
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
