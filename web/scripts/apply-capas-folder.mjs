/**
 * Aplica capas usando mapas gerados por identificação visual (capas-map-*.json).
 * Cada arquivo JSON mapeia nome do arquivo → entry id (UUID).
 *
 *   node scripts/apply-capas-folder.mjs C:\\CAPAS
 *   node scripts/apply-capas-folder.mjs C:\\CAPAS scripts/capas-map-12-07-06.json
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const CAPAS_DIR = process.argv[2] ?? "C:\\CAPAS";
const mapArgPaths = process.argv.slice(3);

const ROOT = path.join(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "covers");
const MAP_PATH = path.join(ROOT, "content", "local-covers.json");

function resolveMapPath(arg) {
  if (path.isAbsolute(arg) && existsSync(arg)) return arg;
  const fromCwd = path.resolve(process.cwd(), arg);
  if (existsSync(fromCwd)) return fromCwd;
  const fromScripts = path.join(import.meta.dirname, path.basename(arg));
  if (existsSync(fromScripts)) return fromScripts;
  return fromCwd;
}

function loadFileMaps() {
  const paths =
    mapArgPaths.length > 0
      ? mapArgPaths.map(resolveMapPath)
      : readdirSync(path.join(import.meta.dirname))
          .filter(
            (f) =>
              f.startsWith("capas-map-") &&
              f.endsWith(".json") &&
              !f.includes(".partial."),
          )
          .map((f) => path.join(import.meta.dirname, f));

  const fileToEntry = {};
  for (const filePath of paths) {
    if (!existsSync(filePath)) continue;
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    for (const [fileName, entryId] of Object.entries(raw)) {
      if (fileName.startsWith("_")) continue;
      if (typeof entryId !== "string") continue;
      fileToEntry[fileName] = entryId;
    }
  }
  return fileToEntry;
}

if (!existsSync(CAPAS_DIR)) {
  console.error(`Pasta não encontrada: ${CAPAS_DIR}`);
  process.exit(1);
}

const fileToEntry = loadFileMaps();
if (Object.keys(fileToEntry).length === 0) {
  console.error(
    "Nenhum mapa capas-map-*.json encontrado. Gere os mapas antes de aplicar.",
  );
  process.exit(1);
}

/** Primeiro arquivo mapeado vence se o mesmo jogo aparecer em lotes diferentes. */
const entryToFile = new Map();
for (const [fileName, entryId] of Object.entries(fileToEntry)) {
  const src = path.join(CAPAS_DIR, fileName);
  if (!existsSync(src)) {
    console.warn(`Arquivo ausente: ${fileName}`);
    continue;
  }
  if (!entryToFile.has(entryId)) entryToFile.set(entryId, fileName);
}

mkdirSync(OUT_DIR, { recursive: true });

let map = {};
if (existsSync(MAP_PATH)) {
  try {
    map = JSON.parse(readFileSync(MAP_PATH, "utf8"));
  } catch {
    map = {};
  }
}

for (const [entryId, fileName] of entryToFile) {
  const src = path.join(CAPAS_DIR, fileName);
  const destName = `${entryId}.jpg`;
  copyFileSync(src, path.join(OUT_DIR, destName));
  map[entryId] = `/covers/${destName}`;
}

writeFileSync(MAP_PATH, `${JSON.stringify(map, null, 2)}\n`);

console.log(`Arquivos mapeados: ${Object.keys(fileToEntry).length}`);
console.log(`Jogos com capa: ${Object.keys(map).length}`);
console.log(`Mapa: ${MAP_PATH}`);
