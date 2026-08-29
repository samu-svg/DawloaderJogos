/**
 * HEAD-check official Xbox 360 marketplace boxarts.
 *   node scripts/probe-xbox360-covers.mjs
 */
import { GAME_TITLE_IDS, xbox360CoverUrl } from "./xbox360-covers.mjs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function probe(url) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA },
      redirect: "follow",
    });
    return { ok: response.ok, status: response.status, type: response.headers.get("content-type") };
  } catch (error) {
    return { ok: false, status: 0, error: String(error) };
  }
}

const entries = Object.entries(GAME_TITLE_IDS);
const failed = [];
const ok = [];

for (let i = 0; i < entries.length; i += 8) {
  const batch = entries.slice(i, i + 8);
  const results = await Promise.all(
    batch.map(async ([id, titleId]) => {
      const url = xbox360CoverUrl(titleId);
      const result = await probe(url);
      return { id, titleId, url, ...result };
    }),
  );
  for (const item of results) {
    if (item.ok) ok.push(item);
    else failed.push(item);
    const mark = item.ok ? "OK" : "FAIL";
    console.log(`${mark} ${item.titleId} ${item.status} ${item.id}`);
  }
}

console.log(`\nOK ${ok.length} / FAIL ${failed.length}`);
for (const item of failed) {
  console.log(`  ${item.titleId} ${item.status} ${item.url}`);
}
