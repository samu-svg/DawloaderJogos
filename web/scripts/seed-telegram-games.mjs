/**
 * Insert Telegram pack games into jogos360 via Supabase MCP/SQL.
 * Also merges page metadata into xbox360-game-pages.json.
 *
 *   node scripts/seed-telegram-games.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const PORTFOLIO_ID = "e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda";
const START_SORT = 63;

const games = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "telegram-games-catalog.json"), "utf8"),
);

const pagesPath = path.join(import.meta.dirname, "../content/xbox360-game-pages.json");
const pages = JSON.parse(readFileSync(pagesPath, "utf8"));

const values = games.map((game, index) => {
  const sortOrder = START_SORT + index;
  pages[game.id] = {
    displayTitle: game.displayTitle,
    description: game.description,
    audio: game.audio,
    audioNote: game.audioNote,
    installHint: "games",
    dlcNotes: game.dlcNotes ?? [],
    ...(game.technicalNotes ? { technicalNotes: game.technicalNotes } : {}),
  };

  const label = game.label.replace(/'/g, "''");
  const dest = game.destination.replace(/'/g, "''");
  const key = game.storage_key.replace(/'/g, "''");
  const cover = game.cover_url.replace(/'/g, "''");

  return `('${game.id}', '${PORTFOLIO_ID}', '${label}', '${dest}', ${game.size_bytes}, 'hosted', '${key}', false, 'jogo', ${sortOrder}, '${cover}')`;
});

writeFileSync(pagesPath, `${JSON.stringify(pages, null, 2)}\n`);

const sqlPath = path.join(import.meta.dirname, "seed-telegram.sql");
writeFileSync(
  sqlPath,
  `INSERT INTO public.entries (id, portfolio_id, label, destination, size_bytes, kind, storage_key, is_optional, group_name, sort_order, cover_url)
VALUES
${values.join(",\n")}
ON CONFLICT DO NOTHING;
`,
  "utf8",
);

console.log(`Updated ${games.length} entries in xbox360-game-pages.json`);
console.log(`Wrote ${sqlPath}`);
