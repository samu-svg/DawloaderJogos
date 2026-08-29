import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  emptyHdIndex,
  emptyParentsToRemove,
  mergeHdLibrary,
  parseHdIndex,
  removeInstalled,
  shouldTreatAsInstallUnit,
  upsertInstalled,
  upsertLabel,
  validateDeleteDestination,
  type HdInstalledRecord,
  type HdLibraryHint,
  type HdLibraryIndex,
  type HdLibraryItem,
  type HdScannedItem,
} from "../shared/hd-library";
import { resolveUnderRoot } from "./paths";

const INDEX_DIR = ".montahd";
const INDEX_FILE = "installed.json";

const IGNORED_NAMES = new Set([
  ".montahd",
  "desktop.ini",
  "thumbs.db",
  "$recycle.bin",
  "system volume information",
]);

function indexFilePath(rootDir: string): string {
  return path.join(rootDir, INDEX_DIR, INDEX_FILE);
}

function shouldIgnoreName(name: string): boolean {
  if (name.startsWith(".")) return true;
  return IGNORED_NAMES.has(name.toLowerCase());
}

export async function readHdIndex(rootDir: string): Promise<HdLibraryIndex> {
  const file = indexFilePath(rootDir);
  if (!existsSync(file)) return emptyHdIndex();
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as unknown;
    return parseHdIndex(raw);
  } catch {
    return emptyHdIndex();
  }
}

export async function writeHdIndex(
  rootDir: string,
  index: HdLibraryIndex,
): Promise<void> {
  const dir = path.join(rootDir, INDEX_DIR);
  await mkdir(dir, { recursive: true });
  const file = indexFilePath(rootDir);
  const temp = `${file}.tmp`;
  await writeFile(temp, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  await rm(file, { force: true });
  await renameOrCopy(temp, file);
}

async function renameOrCopy(from: string, to: string): Promise<void> {
  try {
    await rename(from, to);
  } catch {
    const data = await readFile(from);
    await writeFile(to, data);
    await rm(from, { force: true });
  }
}

export async function recordInstalled(
  rootDir: string,
  record: Omit<HdInstalledRecord, "installedAt">,
): Promise<void> {
  const index = upsertInstalled(await readHdIndex(rootDir), record);
  await writeHdIndex(rootDir, index);
}

export async function rememberHdLabels(
  rootDir: string,
  hints: HdLibraryHint[],
): Promise<void> {
  if (hints.length === 0) return;
  const index = await readHdIndex(rootDir);
  for (const hint of hints) upsertLabel(index, hint);
  index.updatedAt = new Date().toISOString();
  await writeHdIndex(rootDir, index);
}

export async function listHdLibrary(
  rootDir: string,
  hints: HdLibraryHint[] = [],
): Promise<HdLibraryItem[]> {
  const index = await readHdIndex(rootDir);
  const scanned = await scanHd(rootDir);
  const items = mergeHdLibrary({
    scanned,
    index: index.items,
    hints: [...index.labels, ...hints],
  });

  const kept = index.items.filter((record) =>
    items.some(
      (item) => item.source === "index" && item.id === record.id,
    ),
  );
  if (kept.length !== index.items.length) {
    index.items = kept;
    index.updatedAt = new Date().toISOString();
    await writeHdIndex(rootDir, index);
  }

  return items;
}

export async function deleteHdItem(
  rootDir: string,
  destination: string,
): Promise<{ ok: true; alreadyGone?: boolean }> {
  const validated = validateDeleteDestination(destination);
  if (!validated.ok) throw new Error(validated.error);

  const resolved = resolveUnderRoot(rootDir, validated.destination);
  if (!resolved.ok) throw new Error(resolved.error);

  if (!existsSync(resolved.fullPath)) {
    const index = removeInstalled(await readHdIndex(rootDir), validated.destination);
    await writeHdIndex(rootDir, index);
    return { ok: true, alreadyGone: true };
  }

  await rm(resolved.fullPath, { recursive: true, force: true });

  for (const parent of emptyParentsToRemove(validated.destination)) {
    const parentResolved = resolveUnderRoot(rootDir, parent);
    if (!parentResolved.ok) continue;
    try {
      const entries = await readdir(parentResolved.fullPath);
      if (entries.length === 0) {
        await rm(parentResolved.fullPath, { recursive: true, force: true });
      }
    } catch {
      // pasta já sumiu ou sem permissão — segue
    }
  }

  const index = removeInstalled(await readHdIndex(rootDir), validated.destination);
  await writeHdIndex(rootDir, index);
  return { ok: true };
}

async function scanHd(rootDir: string): Promise<HdScannedItem[]> {
  const items: HdScannedItem[] = [];
  const games = path.join(rootDir, "Games");
  const content = path.join(rootDir, "Content");

  if (existsSync(games)) {
    items.push(...(await scanGames(games)));
  }
  if (existsSync(content)) {
    items.push(...(await walkContent(content, "Content", 1)));
  }

  return items;
}

async function scanGames(gamesDir: string): Promise<HdScannedItem[]> {
  const entries = await readdir(gamesDir, { withFileTypes: true });
  const items: HdScannedItem[] = [];
  for (const entry of entries) {
    if (shouldIgnoreName(entry.name)) continue;
    const destination = `Games/${entry.name}`;
    items.push({
      destination,
      sizeBytes: await safeSize(path.join(gamesDir, entry.name)),
    });
  }
  return items;
}

async function walkContent(
  absDir: string,
  relative: string,
  depth: number,
): Promise<HdScannedItem[]> {
  let entries: { name: string; isDirectory: boolean }[] = [];
  try {
    entries = (await readdir(absDir, { withFileTypes: true }))
      .filter((entry) => !shouldIgnoreName(entry.name))
      .map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
      }));
  } catch {
    return [];
  }

  if (shouldTreatAsInstallUnit(relative, entries, depth)) {
    return [{ destination: relative, sizeBytes: await safeSize(absDir) }];
  }

  const items: HdScannedItem[] = [];
  for (const entry of entries) {
    const childRel = `${relative}/${entry.name}`;
    const childAbs = path.join(absDir, entry.name);
    if (!entry.isDirectory) {
      items.push({
        destination: childRel,
        sizeBytes: await safeSize(childAbs),
      });
      continue;
    }
    items.push(...(await walkContent(childAbs, childRel, depth + 1)));
  }
  return items;
}

async function safeSize(target: string): Promise<number> {
  try {
    const info = await stat(target);
    if (info.isFile()) return info.size;
    if (!info.isDirectory()) return 0;
    return await directorySize(target);
  } catch {
    return 0;
  }
}

async function directorySize(dir: string): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) total += await directorySize(abs);
      else if (entry.isFile()) total += (await stat(abs)).size;
    } catch {
      // ignora arquivos bloqueados
    }
  }
  return total;
}
