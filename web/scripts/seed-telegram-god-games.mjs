/**
 * Insert GOD-format Telegram pack games into jogos360 and merge page metadata.
 *
 *   node scripts/seed-telegram-god-games.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const PORTFOLIO_ID = "e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda";
const START_SORT = 95;

const games = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "telegram-god-games-catalog.json"), "utf8"),
);

const pagesPath = path.join(import.meta.dirname, "../content/xbox360-game-pages.json");
const pages = JSON.parse(readFileSync(pagesPath, "utf8"));

function sanitizeName(name) {
  return name.replace(/[<>:"|?*\\]/g, "_").replace(/\s+/g, " ").trim();
}

const values = games.map((game, index) => {
  const sortOrder = START_SORT + index;
  const storageKey = `jogos/${sanitizeName(game.folderName)}.zip`;
  const destination = `Content/0000000000000000/${game.contentTitleId}.zip`;

  pages[game.id] = {
    displayTitle: game.displayTitle,
    description: game.description,
    audio: game.audio,
    audioNote: game.audioNote,
    installHint: "content",
    dlcNotes: [
      `Title ID ${game.contentTitleId} — destino Content/0000000000000000/${game.contentTitleId}. Pacote GOD; o zip contém a pasta Content pronta para a raiz do HD.`,
    ],
  };

  const label = game.label.replace(/'/g, "''");
  const dest = destination.replace(/'/g, "''");
  const key = storageKey.replace(/'/g, "''");
  const cover = game.cover_url.replace(/'/g, "''");
  const size = game.size_bytes ?? 0;

  return `('${game.id}', '${PORTFOLIO_ID}', '${label}', '${dest}', ${size}, 'hosted', '${key}', false, 'jogo', ${sortOrder}, '${cover}')`;
});

writeFileSync(pagesPath, `${JSON.stringify(pages, null, 2)}\n`);

const sqlPath = path.join(import.meta.dirname, "seed-telegram-god.sql");
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
  sort_order = EXCLUDED.sort_order,
  cover_url = EXCLUDED.cover_url;
`,
  "utf8",
);

console.log(`Updated ${games.length} GOD entries in xbox360-game-pages.json`);
console.log(`Wrote ${sqlPath}`);
