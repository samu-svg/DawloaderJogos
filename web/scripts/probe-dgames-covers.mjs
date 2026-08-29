/**
 * HEAD-check Xbox 360 covers for D:\Games metadata Title IDs.
 *   node scripts/probe-dgames-covers.mjs
 */
import { readFileSync } from "node:fs";
import { xbox360CoverUrl } from "./xbox360-covers.mjs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

const metadata = JSON.parse(
  readFileSync(new URL("./dgames-metadata.json", import.meta.url), "utf8"),
);

const unique = new Map();
for (const [folder, meta] of Object.entries(metadata)) {
  if (meta.titleId) unique.set(meta.titleId, folder);
}

let ok = 0;
let fail = 0;
const failed = [];

for (const [titleId, folder] of unique) {
  const url = xbox360CoverUrl(titleId);
  const good = await probe(url);
  if (good) {
    ok += 1;
    console.log(`OK ${titleId} — ${folder.slice(0, 50)}`);
  } else {
    fail += 1;
    failed.push({ titleId, folder, url });
    console.log(`FAIL ${titleId} — ${folder.slice(0, 50)}`);
  }
}

console.log(`\nOK ${ok} / FAIL ${fail}`);
for (const item of failed) console.log(`  ${item.titleId} ${item.url}`);
