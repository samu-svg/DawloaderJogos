/**
 * Download Xbox Marketplace covers for MontaHD catalog entries.
 *
 *   node scripts/fetch-montahd-covers.mjs
 */
import { createWriteStream, readFileSync, writeFileSync } from "node:fs";
import { get } from "node:https";
import path from "node:path";
import { xbox360CoverUrl } from "./xbox360-covers.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "covers");
const MAP_PATH = path.join(ROOT, "content", "local-covers.json");
const START_SORT = 187;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function makeId(index) {
  const hex = (START_SORT + index).toString(16).padStart(4, "0");
  return `c2d3e4f5-0001-4000-8000-00000000${hex}`;
}

async function probe(url) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA },
      redirect: "follow",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    get(url, { headers: { "User-Agent": UA } }, (response) => {
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

const catalog = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "montahd-packs-catalog.json"), "utf8"),
);
const metadata = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "montahd-metadata.json"), "utf8"),
);
const eligible = catalog.filter((g) => g.status === "uploaded" && (g.size_bytes ?? 0) > 10_000);
const map = JSON.parse(readFileSync(MAP_PATH, "utf8"));

let ok = 0;
let fail = 0;

for (let i = 0; i < eligible.length; i += 1) {
  const game = eligible[i];
  const meta = metadata[game.folderName] ?? {};
  const titleId = (meta.titleId ?? game.contentTitleId)?.toUpperCase();
  const entryId = makeId(i);
  const label = meta.displayTitle ?? game.folderName;

  if (!titleId) {
    console.log(`SKIP ${label} (no titleId)`);
    fail += 1;
    continue;
  }

  const url = xbox360CoverUrl(titleId);
  if (!(await probe(url))) {
    console.log(`FAIL ${label} (${titleId}) cover unavailable`);
    fail += 1;
    continue;
  }

  const dest = path.join(OUT_DIR, `${entryId}.jpg`);
  try {
    await download(url, dest);
    map[entryId] = `/covers/${entryId}.jpg`;
    ok += 1;
    console.log(`OK ${label}`);
  } catch (error) {
    console.log(`FAIL ${label}: ${error instanceof Error ? error.message : error}`);
    fail += 1;
  }
}

writeFileSync(MAP_PATH, `${JSON.stringify(map, null, 2)}\n`);
console.log(`\nCovers: ${ok} ok, ${fail} fail`);
