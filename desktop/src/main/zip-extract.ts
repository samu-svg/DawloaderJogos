import { access, lstat, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import extract from "extract-zip";

const CONTENT_GOD_RE = /(?:^|\/)Content\/0000000000000000\/([0-9A-Fa-f]{8})$/i;

/** Se o zip tiver uma única pasta na raiz, usa o conteúdo dela (evita Games/Jogo/Jogo/...). */
export async function detectContentRoot(dir: string): Promise<string> {
  let current = dir;
  for (let depth = 0; depth < 8; depth += 1) {
    const entries = await readdir(current, { withFileTypes: true });
    const dirs = entries.filter((entry) => entry.isDirectory());
    const files = entries.filter((entry) => entry.isFile());
    if (dirs.length === 1 && files.length === 0) {
      current = path.join(current, dirs[0].name);
      continue;
    }
    break;
  }
  return current;
}

/** Localiza a pasta Title ID de um pacote GOD dentro do zip extraído. */
export async function findGodTitleFolder(
  root: string,
  titleId: string,
): Promise<string | null> {
  const target = titleId.toUpperCase();

  async function walk(dir: string, depth: number): Promise<string | null> {
    if (depth > 12) return null;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name.toUpperCase() === target) return full;
      const found = await walk(full, depth + 1);
      if (found) return found;
    }
    return null;
  }

  return walk(root, 0);
}

function parseGodTitleId(installDir: string): string | null {
  const normalized = installDir.replace(/\\/g, "/");
  const match = normalized.match(CONTENT_GOD_RE);
  return match?.[1]?.toUpperCase() ?? null;
}

/**
 * Escolhe a pasta cujo conteúdo será copiado para o destino no HD.
 * Pacotes GOD (Content/0000000000000000/{TitleID}) param na pasta Title ID,
 * preservando subpastas como 00007000 — detectContentRoot sozinho as remove.
 */
export async function resolveExtractRoot(
  tempDir: string,
  installDir: string,
): Promise<string> {
  const titleId = parseGodTitleId(installDir);
  if (titleId) {
    const godFolder = await findGodTitleFolder(tempDir, titleId);
    if (godFolder) return godFolder;
  }

  return detectContentRoot(tempDir);
}

/** Ignora arquivos dentro de pastas Content ao copiar jogo para Games/. */
export function shouldCopyGameFile(relativePath: string): boolean {
  const segments = relativePath.replace(/\\/g, "/").split("/");
  return !segments.some((segment) => segment.toLowerCase() === "content");
}

/** Localiza árvores Content/0000000000000000 dentro do zip extraído. */
export async function findContentInstallTrees(root: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 15) return;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name.toLowerCase() === "content") {
        try {
          await access(path.join(full, "0000000000000000"));
          found.push(full);
          continue;
        } catch {
          // not an Xbox Content tree
        }
      }
      await walk(full, depth + 1);
    }
  }

  await walk(root, 0);
  return found;
}

export function isGamesDestination(installDir: string): boolean {
  const normalized = installDir.replace(/\\/g, "/").toLowerCase();
  return normalized.startsWith("games/") || normalized.includes("/games/");
}

const UNIX_MADE_BY = 3;
const UNIX_SYMLINK_MASK = 0o170000;
const UNIX_SYMLINK_TYPE = 0o120000;

type ZipEntryLike = {
  fileName: string;
  versionMadeBy?: number;
  externalFileAttributes?: number;
};

export function isZipSymlinkEntry(entry: ZipEntryLike): boolean {
  const madeBy = (entry.versionMadeBy ?? 0) >> 8;
  if (madeBy !== UNIX_MADE_BY) return false;
  const mode = (entry.externalFileAttributes ?? 0) >>> 16;
  return (mode & UNIX_SYMLINK_MASK) === UNIX_SYMLINK_TYPE;
}

/** Resolves an archive entry under `rootDir`; throws if it would escape. */
export function assertZipEntryPath(rootDir: string, entryName: string): string {
  const raw = entryName.replace(/\\/g, "/");
  if (raw.startsWith("/") || raw.startsWith("//") || /^[A-Za-z]:/.test(raw)) {
    throw new Error("O zip contém um caminho absoluto, que não é aceito.");
  }

  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, raw);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("O zip tenta gravar fora da pasta de extração.");
  }
  return resolved;
}

export async function assertNoSymlinks(rootDir: string): Promise<void> {
  const root = path.resolve(rootDir);
  const stack = [root];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const stats = await lstat(full);
      if (stats.isSymbolicLink()) {
        throw new Error("O zip contém um atalho (symlink), que não é aceito.");
      }
      if (stats.isDirectory()) stack.push(full);
    }
  }
}

export function isZipPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".zip");
}

export async function isZipFile(filePath: string): Promise<boolean> {
  if (isZipPath(filePath)) return true;
  const { open } = await import("node:fs/promises");
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(4);
    const { bytesRead } = await handle.read(buffer, 0, 4, 0);
    if (bytesRead < 2) return false;
    return buffer[0] === 0x50 && buffer[1] === 0x4b;
  } finally {
    await handle.close();
  }
}

/** Extrai um zip para pasta temporária e devolve a raiz do conteúdo. */
export async function extractZipToContentRoot(
  zipPath: string,
  installDir?: string,
  extractParent?: string,
): Promise<{
  contentRoot: string;
  tempDir: string;
}> {
  const tempDir = await createExtractTempDir(extractParent);
  const root = path.resolve(tempDir);
  try {
    await extract(zipPath, {
      dir: root,
      onEntry(entry) {
        assertZipEntryPath(root, entry.fileName);
        if (isZipSymlinkEntry(entry)) {
          throw new Error("O zip contém um atalho (symlink), que não é aceito.");
        }
      },
    });
    await assertNoSymlinks(root);
    const contentRoot = installDir
      ? await resolveExtractRoot(tempDir, installDir)
      : await detectContentRoot(tempDir);
    return { contentRoot, tempDir };
  } catch (error) {
    await removeTempDir(tempDir);
    throw translateExtractError(error);
  }
}

function translateExtractError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid relative path|Unable to extract archive outside|absolute path/i.test(message)) {
    return new Error("O zip tenta gravar fora da pasta de extração.");
  }
  if (error instanceof Error) return error;
  return new Error(message);
}

/** Pasta temporária da extração (HD `.montahd` se o zip cabe no FAT32; senão staging no PC). */
async function createExtractTempDir(extractParent?: string): Promise<string> {
  if (extractParent?.trim()) {
    await mkdir(extractParent, { recursive: true });
    return mkdtemp(path.join(extractParent, "extract-"));
  }
  return mkdtemp(path.join(os.tmpdir(), "montahd-"));
}

export async function removeTempDir(tempDir: string): Promise<void> {
  await rm(tempDir, { recursive: true, force: true });
}
