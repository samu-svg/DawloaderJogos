/**
 * Baixa capas Xbox Marketplace para jogos sem foto em C:\CAPAS.
 */
import { createWriteStream, readFileSync, writeFileSync } from "node:fs";
import { get } from "node:https";
import path from "node:path";
import { xbox360CoverUrl } from "./xbox360-covers.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "covers");
const MAP_PATH = path.join(ROOT, "content", "local-covers.json");

const MISSING = {
  "a1b2c3d1-0001-4000-8000-000000000026": "415607DE", // Wolfenstein PT-BR
  "b2c3d4e5-0001-4000-8000-000000000072": "415608FC", // Call of Duty - Ghosts
  "b2c3d4e5-0001-4000-8000-000000000090": "5841122D", // jogos Final de Ano (Guitar Hero bundle)
  "b2c3d4e5-0001-4000-8000-0000000000a7": "5454086B", // RDR Undead Nightmare (GOTY)
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`${url} → HTTP ${response.statusCode}`));
        return;
      }
      const file = createWriteStream(dest);
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", reject);
    }).on("error", reject);
  });
}

const map = JSON.parse(readFileSync(MAP_PATH, "utf8"));

for (const [entryId, titleId] of Object.entries(MISSING)) {
  const dest = path.join(OUT_DIR, `${entryId}.jpg`);
  const url = xbox360CoverUrl(titleId);
  await download(url, dest);
  map[entryId] = `/covers/${entryId}.jpg`;
  console.log(`OK ${entryId.slice(-4)} (${titleId})`);
}

writeFileSync(MAP_PATH, `${JSON.stringify(map, null, 2)}\n`);
console.log(`Total capas locais: ${Object.keys(map).length}`);
