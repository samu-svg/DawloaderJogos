/**
 * Insert C:\.montahd pack games into jogos360.
 * Reads montahd-packs-catalog.json + montahd-metadata.json.
 *
 *   node scripts/seed-montahd-packs.mjs
 *   node --env-file=.env.local scripts/seed-montahd-packs.mjs --apply
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { xbox360CoverUrl } from "./xbox360-covers.mjs";

const PORTFOLIO_ID = "e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda";
const START_SORT = 187;
const FALLBACK_COVER =
  "https://download-ssl.xbox.com/content/images/66acd000-77fe-1000-9115-d8024d530805/1033/boxartlg.jpg";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function makeId(index) {
  const hex = (START_SORT + index).toString(16).padStart(4, "0");
  return `c2d3e4f5-0001-4000-8000-00000000${hex}`;
}

function isEligible(game) {
  return game.status === "uploaded" && (game.size_bytes ?? 0) > 10_000;
}

function decodeHtml(text) {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"');
}

function resolveTitleId(game, meta) {
  return meta?.titleId ?? game.contentTitleId ?? null;
}

function installHintFor(game) {
  if (game.format === "god-multi" || game.format === "god") return "content";
  return "games";
}

function destinationFor(game) {
  if (game.destination) return game.destination;
  if (game.format === "xex") {
    return `Games/${game.folderName.replace(/[<>:"|?*\\]/g, "_").replace(/\s+/g, " ").trim()}.zip`;
  }
  return game.destination;
}

const catalogPath = path.join(import.meta.dirname, "montahd-packs-catalog.json");
const metadataPath = path.join(import.meta.dirname, "montahd-metadata.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));

const eligible = catalog.filter(isEligible);

const pagesPath = path.join(import.meta.dirname, "../content/xbox360-game-pages.json");
const titleIdsPath = path.join(import.meta.dirname, "../lib/xbox360-title-ids.json");
const pages = JSON.parse(readFileSync(pagesPath, "utf8"));
const titleIds = JSON.parse(readFileSync(titleIdsPath, "utf8"));

const rows = eligible.map((game, index) => {
  const meta = metadata[game.folderName] ?? {};
  const id = makeId(index);
  const titleId = resolveTitleId(game, meta);
  const displayTitle = decodeHtml(meta.displayTitle ?? game.folderName);
  const label = displayTitle;
  const storageKey = game.storage_key;
  const destination = destinationFor(game);
  const size = game.size_bytes ?? 0;
  const sortOrder = START_SORT + index;
  const cover = titleId ? xbox360CoverUrl(titleId) : FALLBACK_COVER;
  const installHint = installHintFor(game);
  const groupName = meta.groupName ?? "jogo";

  const audioNote =
    installHint === "content" && titleId
      ? `Pacote GOD/XBLA (Content). Title ID ${titleId}.`
      : `Pasta Games: ${game.folderName}.`;

  const pageEntry = {
    displayTitle,
    description:
      meta.description ??
      `Jogo Xbox 360 do acervo MontaHD (pack: ${game.pack ?? "—"}).`,
    audio: meta.audio ?? "desconhecido",
    audioNote,
    installHint,
  };

  if (installHint === "content" && titleId) {
    pageEntry.dlcNotes = [
      `Title ID ${titleId} — destino Content/0000000000000000/${titleId}. Pacote GOD; o zip contém a pasta Content pronta para a raiz do HD.`,
    ];
  } else {
    pageEntry.technicalNotes = [
      `Destino Games/${displayTitle}.zip — extração na pasta Games/ do HD.`,
    ];
  }

  pages[id] = pageEntry;

  if (titleId) {
    titleIds[titleId.toUpperCase()] = displayTitle;
  }

  return {
    id,
    label,
    folderName: game.folderName,
    destination,
    size,
    storageKey,
    isOptional: false,
    groupName,
    sortOrder,
    cover,
    titleId,
    displayTitle,
  };
});

writeFileSync(pagesPath, `${JSON.stringify(pages, null, 2)}\n`);
writeFileSync(titleIdsPath, `${JSON.stringify(titleIds, null, 2)}\n`);

const esc = (s) => String(s).replace(/'/g, "''");
const values = rows.map(
  (row) =>
    `('${row.id}', '${PORTFOLIO_ID}', '${esc(row.label)}', '${esc(row.destination)}', ${row.size}, 'hosted', '${esc(row.storageKey)}', ${row.isOptional}, '${row.groupName}', ${row.sortOrder}, '${esc(row.cover)}')`,
);

const sqlPath = path.join(import.meta.dirname, "seed-montahd-packs.sql");
const sql = `INSERT INTO public.entries (id, portfolio_id, label, destination, size_bytes, kind, storage_key, is_optional, group_name, sort_order, cover_url)
VALUES
${values.join(",\n")}
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  destination = EXCLUDED.destination,
  size_bytes = EXCLUDED.size_bytes,
  is_optional = EXCLUDED.is_optional,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order,
  cover_url = EXCLUDED.cover_url,
  storage_key = EXCLUDED.storage_key;
`;

writeFileSync(sqlPath, sql, "utf8");

console.log(`Prepared ${eligible.length} MontaHD entries`);
console.log(`Updated xbox360-game-pages.json and xbox360-title-ids.json`);
console.log(`Wrote ${sqlPath}`);

if (process.argv.includes("--apply")) {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  const { data: existing } = await supabase
    .from("entries")
    .select("storage_key")
    .eq("portfolio_id", PORTFOLIO_ID);

  const existingKeys = new Set((existing ?? []).map((row) => row.storage_key));
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const payload = {
      id: row.id,
      portfolio_id: PORTFOLIO_ID,
      label: row.label,
      destination: row.destination,
      size_bytes: row.size,
      kind: "hosted",
      storage_key: row.storageKey,
      is_optional: row.isOptional,
      group_name: row.groupName,
      sort_order: row.sortOrder,
      cover_url: row.cover,
    };

    if (existingKeys.has(row.storageKey)) {
      const { error } = await supabase
        .from("entries")
        .update(payload)
        .eq("storage_key", row.storageKey);
      if (error) console.error(`UPDATE FAIL ${row.storageKey}: ${error.message}`);
      else {
        updated += 1;
        console.log(`UPD ${row.storageKey}`);
      }
    } else {
      const { error } = await supabase.from("entries").insert(payload);
      if (error) console.error(`INSERT FAIL ${row.label}: ${error.message}`);
      else {
        inserted += 1;
        console.log(`OK ${row.storageKey}`);
      }
    }
  }

  console.log(`Done: ${inserted} inserted, ${updated} updated`);
}
