/**
 * Gera content/game-categories.json a partir de xbox360-game-pages.json
 * e seed-dgames-packs.sql. Rode após adicionar jogos ao acervo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pages from "../content/xbox360-game-pages.json" with { type: "json" };
import dgames from "../scripts/dgames-metadata.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "../content/game-categories.json");

const INFERENCE_RULES = [
  { categories: ["colecao"], pattern: /\b(cole[cç][aã]o|collection|pack|pacote|legends|cl[aá]ssicos|brazukas|natal)\b/i },
  { categories: ["esportes"], pattern: /\b(fifa|pes\b|pro evolution|ea fc|f1\b|nba\b|nfl\b|madden|nhl\b|copa do mundo|football|soccer|ufc\b|wwe\b)/i },
  { categories: ["corrida"], pattern: /\b(forza|need for speed|nfs\b|dirt\b|ride\b|ridge racer|burnout|grid\b|motorstorm|skate\b|mx\b|baja\b)/i },
  { categories: ["luta"], pattern: /\b(dragon ball|tekken|mortal kombat|street fighter|soulcalibur|ufc\b|wwe\b|def jam|naruto\b|burst limit|raging blast|tenkaichi)/i },
  { categories: ["musica"], pattern: /\b(guitar hero|rock band|dance central|just dance|aerosmith|warriors of rock)/i },
  { categories: ["familia"], pattern: /\b(lego\b|disney|pixar|barbie|ben 10|spongebob|hot wheels|cars\b|toy story|kinect|chavo|ducktales|mickey|turtles in time)/i },
  { categories: ["terror"], pattern: /\b(resident evil|dead space|f\.?e\.?a\.?r|silent hill|dead island|alan wake|evil within|amnesia|zombie|undead|bioshock)/i },
  { categories: ["fps"], pattern: /\b(call of duty|cod\b|battlefield|halo\b|metro\b|medal of honor|titanfall|borderlands|duke nukem|crysis|far cry|ghost recon|rainbow six)/i },
  { categories: ["mundo-aberto", "acao"], pattern: /\b(gta\b|grand theft auto|saints row|mafia\b|red dead|watch dogs|sleeping dogs|bully\b|assassin'?s creed|godfather|just cause)/i },
  { categories: ["rpg"], pattern: /\b(dragon age|elder scrolls|skyrim|fallout|mass effect|final fantasy|dark souls|fable\b|borderlands|kingdoms of amalur|witcher)/i },
  { categories: ["estrategia"], pattern: /\b(civilization|command & conquer|starcraft|age of empires|xcom|worms\b)/i },
  { categories: ["plataforma"], pattern: /\b(mario\b|sonic\b|banjo|rayman|castlevania|megaman|mega man|spongebob|ducktales)/i },
  { categories: ["aventura"], pattern: /\b(tomb raider|uncharted|life is strange|telltaile|walking dead|portal\b|back to the future|harry potter|indiana jones|alice madness)/i },
  { categories: ["acao"], pattern: /\b(devil may cry|dmc\b|gears of war|batman|transformers|star wars|asura|bayonetta|prototype|infamous|max payne|turok\b|deadpool|dante'?s inferno)/i },
];

/** Overrides manuais por UUID completo. */
const OVERRIDES = {
  "b78e07fc-5d14-450e-8f31-69c649f61563": ["aventura", "plataforma"],
  "764c602c-1b14-4244-a613-19fbdc176e84": ["plataforma", "aventura"],
  "b2c3d4e5-0001-4000-8000-00000000008b": ["mundo-aberto", "acao"],
  "2820c254-0000-0000-0000-000000000000": ["fps", "colecao"],
};

function infer(label, displayTitle, description) {
  const haystack = [label, displayTitle, description].filter(Boolean).join(" ");
  for (const rule of INFERENCE_RULES) {
    if (rule.pattern.test(haystack)) return [...rule.categories];
  }
  return ["acao"];
}

const result = {};

for (const [id, meta] of Object.entries(pages)) {
  result[id] = OVERRIDES[id] ?? infer("", meta.displayTitle, meta.description);
}

const sql = readFileSync(join(__dirname, "seed-dgames-packs.sql"), "utf8");
const rowRe = /\('([0-9a-f-]{36})',\s*'[^']*',\s*'((?:[^'\\]|\\.)*)'/gi;
let match;
while ((match = rowRe.exec(sql)) !== null) {
  const [, id, rawLabel] = match;
  const label = rawLabel.replace(/''/g, "'");
  if (result[id]) continue;
  const dgMeta = dgames[label];
  result[id] =
    OVERRIDES[id] ??
    infer(label, dgMeta?.displayTitle, dgMeta?.description);
}

writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`Wrote ${Object.keys(result).length} entries to ${outPath}`);
