import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const sql = readFileSync(new URL("./seed-dgames-packs.sql", import.meta.url), "utf8");
const footer = `ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  destination = EXCLUDED.destination,
  size_bytes = EXCLUDED.size_bytes,
  is_optional = EXCLUDED.is_optional,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order,
  cover_url = EXCLUDED.cover_url,
  storage_key = EXCLUDED.storage_key;`;

const match = sql.match(/VALUES\s*\n([\s\S]*)\nON CONFLICT/);
if (!match) throw new Error("Could not parse SQL");
const values = match[1]
  .trim()
  .split(/,\n/)
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((v) => !v.includes("SplinterCell Blacklist"));

const header = `INSERT INTO public.entries (id, portfolio_id, label, destination, size_bytes, kind, storage_key, is_optional, group_name, sort_order, cover_url)
VALUES`;

const chunks = [];
for (let i = 0; i < values.length; i += 25) {
  const batch = values.slice(i, i + 25);
  chunks.push(`${header}\n${batch.join(",\n")}\n${footer}`);
}

const tmpDir = path.join(os.tmpdir(), "montahd-dgames");
mkdirSync(tmpDir, { recursive: true });
writeFileSync(path.join(tmpDir, "dgames-chunks.json"), JSON.stringify(chunks));
for (let i = 0; i < chunks.length; i += 1) {
  writeFileSync(path.join(tmpDir, `dgames-batch-${i}.sql`), chunks[i]);
}
console.log(`batches: ${chunks.length}, entries: ${values.length}`);
console.log(`output: ${tmpDir}`);
