/**
 * Seed Telegram DLC entries + update parent game dlcNotes.
 *   node scripts/seed-telegram-dlc-games.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const PORTFOLIO_ID = "e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda";
const START_SORT = 101;

const dlcs = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "telegram-dlc-catalog.json"), "utf8"),
);

const pagesPath = path.join(import.meta.dirname, "../content/xbox360-game-pages.json");
const pages = JSON.parse(readFileSync(pagesPath, "utf8"));

const values = dlcs.map((dlc, index) => {
  const sortOrder = START_SORT + index;
  const storageKey = `jogos/content/${dlc.contentTitleId}.zip`;
  const destination = `Content/0000000000000000/${dlc.contentTitleId}.zip`;

  const parent = pages[dlc.parentGameId];
  if (parent) {
    const note = `DLC opcional Title ID ${dlc.contentTitleId} — destino Content/0000000000000000/${dlc.contentTitleId}.zip (storage_key ${storageKey}).`;
    parent.dlcNotes = [...(parent.dlcNotes ?? []).filter((n) => !n.includes(dlc.contentTitleId)), note];
  }

  const label = dlc.label.replace(/'/g, "''");
  const size = dlc.size_bytes ?? 0;

  return `('${dlc.id}', '${PORTFOLIO_ID}', '${label}', '${destination}', ${size}, 'hosted', '${storageKey}', true, 'conteudo', ${sortOrder}, null)`;
});

writeFileSync(pagesPath, `${JSON.stringify(pages, null, 2)}\n`);

const sqlPath = path.join(import.meta.dirname, "seed-telegram-dlc.sql");
writeFileSync(
  sqlPath,
  `INSERT INTO public.entries (id, portfolio_id, label, destination, size_bytes, kind, storage_key, is_optional, group_name, sort_order, cover_url)
VALUES
${values.join(",\n")}
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  destination = EXCLUDED.destination,
  size_bytes = EXCLUDED.size_bytes,
  storage_key = EXCLUDED.storage_key,
  is_optional = EXCLUDED.is_optional,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order;
`,
  "utf8",
);

console.log(`Updated ${dlcs.length} DLC entries`);
console.log(`Wrote ${sqlPath}`);
