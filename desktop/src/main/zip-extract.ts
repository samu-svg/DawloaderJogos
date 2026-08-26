import { access, mkdtemp, readdir, rm } from "node:fs/promises";
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
): Promise<{
  contentRoot: string;
  tempDir: string;
}> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "montahd-"));
  await extract(zipPath, { dir: tempDir });
  const contentRoot = installDir
    ? await resolveExtractRoot(tempDir, installDir)
    : await detectContentRoot(tempDir);
  return { contentRoot, tempDir };
}

export async function removeTempDir(tempDir: string): Promise<void> {
  await rm(tempDir, { recursive: true, force: true });
}
