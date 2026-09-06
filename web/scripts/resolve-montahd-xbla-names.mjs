/**
 * Resolve XBLA display names from XboxDB and write montahd-metadata.json.
 *
 *   node scripts/resolve-montahd-xbla-names.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const catalogPath = path.join(import.meta.dirname, "montahd-packs-catalog.json");
const metadataPath = path.join(import.meta.dirname, "montahd-metadata.json");

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const existing = (() => {
  try {
    return JSON.parse(readFileSync(metadataPath, "utf8"));
  } catch {
    return {};
  }
})();

async function lookupTitleId(titleId) {
  const url = `https://www.xboxdb.altervista.org/game/${titleId.toLowerCase()}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "MontaHD-catalog/1.0" },
  });
  if (!response.ok) return null;
  const html = await response.text();
  const match = html.match(/<title>([^<|]+)/i);
  const name = match?.[1]?.trim();
  if (!name || name.toLowerCase() === "xboxdb") return null;
  return name;
}

const XEX_TITLES = {
  "Game Party In Motion": {
    displayTitle: "Game Party: In Motion",
    titleId: "4541090A",
    description: "Minijogos para Kinect — festa em família com desafios de movimento.",
  },
  "Harry Potter for Kinect": {
    displayTitle: "Harry Potter for Kinect",
    titleId: "454109A8",
    description: "Aventuras de Harry Potter controladas por gestos no Kinect.",
  },
  "KINECTIMALS NOW WITH BEARS": {
    displayTitle: "Kinectimals: Now with Bears",
    titleId: "4D5309B1",
    description: "Cuide de filhotes virtuais com o Kinect — edição com ursos.",
  },
  "Michael Jackson The Experience": {
    displayTitle: "Michael Jackson: The Experience",
    titleId: "5553088E",
    description: "Dance e cante as coreografias de Michael Jackson com Kinect.",
  },
  "PowerUp Heroes": {
    displayTitle: "PowerUp Heroes",
    titleId: "55530897",
    description: "Luta corpo a corpo com super-heróis usando o Kinect.",
  },
  "SONIC FREE RIDERS": {
    displayTitle: "Sonic Free Riders",
    titleId: "5345085A",
    description: "Corrida de hoverboard da série Sonic com controle Kinect.",
  },
  "Zumba Fitness World Party": {
    displayTitle: "Zumba Fitness: World Party",
    titleId: "454109E8",
    description: "Aulas de Zumba em casa com Kinect e coreografias internacionais.",
  },
  "Zumba Kids": {
    displayTitle: "Zumba Kids",
    titleId: "454109F0",
    description: "Zumba adaptado para crianças com Kinect.",
  },
  "Cabelas.Big.Game.Hunter.Pro.Hunts.2014": {
    displayTitle: "Cabela's Big Game Hunter Pro Hunts 2014",
    titleId: "415608C0",
    description: "Simulador de caça da série Cabela's para Xbox 360.",
  },
  "Project Gotham Racing 4": {
    displayTitle: "Project Gotham Racing 4",
    titleId: "4D5308EB",
    description: "Corrida arcade-realista da série PGR com clima dinâmico.",
  },
  "Rainbow six vegas": {
    displayTitle: "Tom Clancy's Rainbow Six: Vegas",
    titleId: "555307E8",
    description: "Tiro tático em primeira pessoa em Las Vegas.",
  },
  "Sniper Ghost Warrior": {
    displayTitle: "Sniper: Ghost Warrior",
    titleId: "4346081C",
    description: "Atirador de elite em missões furtivas.",
  },
  "Tony Hawks Pro Skater 5": {
    displayTitle: "Tony Hawk's Pro Skater 5",
    titleId: "4156091A",
    description: "Skate arcade da série Tony Hawk.",
  },
};

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"');
}

function needsLookup(meta, titleId) {
  if (!meta?.displayTitle) return true;
  if (meta.displayTitle === titleId) return true;
  if (meta.displayTitle === "-field-") return true;
  if (/^[0-9A-F]{8}$/i.test(meta.displayTitle)) return true;
  return false;
}

const MANUAL_TITLES = {
  "58410865": "Prince of Persia",
  "58410A06": "After Burner Climax",
  "58410A3B": "3D Ultra MiniGolf Adventures 2",
  "58411223": "Marvel vs. Capcom Origins",
  "5841128F": "Terraria: Xbox 360 Edition",
};

const metadata = { ...existing };

for (const game of catalog) {
  if (game.status !== "uploaded") continue;
  const key = game.folderName;

  if (game.format === "god-multi" && game.contentTitleId) {
    const titleId = game.contentTitleId.toUpperCase();
    if (!needsLookup(metadata[key], titleId)) continue;
    process.stdout.write(`${titleId}… `);
    const name = MANUAL_TITLES[titleId] ?? (await lookupTitleId(titleId));
    console.log(name ?? "(not found)");
    const resolved = decodeHtml(name ?? titleId);
    metadata[key] = {
      displayTitle: resolved,
      titleId,
      description: name
        ? `${resolved} — jogo Xbox Live Arcade do pack MontaHD. Instala em Content/0000000000000000/${titleId}.`
        : `Xbox Live Arcade (Title ID ${titleId}) do pack MontaHD.`,
      audio: "desconhecido",
    };
    await new Promise((r) => setTimeout(r, 350));
    continue;
  }

  if (game.format === "xex") {
    const preset = XEX_TITLES[key] ?? {};
    metadata[key] = {
      displayTitle: preset.displayTitle ?? key,
      titleId: preset.titleId ?? null,
      description:
        preset.description ??
        `Jogo Xbox 360 do pack ${game.pack ?? "MontaHD"}. Instala em Games/.`,
      audio: "desconhecido",
    };
  }
}

writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`\nWrote ${metadataPath} (${Object.keys(metadata).length} entries)`);
