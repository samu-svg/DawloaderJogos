import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import extract from "extract-zip";

/** Se o zip tiver uma única pasta na raiz, usa o conteúdo dela (evita Games/Jogo/Jogo/...). */
export async function detectContentRoot(dir: string): Promise<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory());
  const files = entries.filter((entry) => entry.isFile());
  if (dirs.length === 1 && files.length === 0) {
    return path.join(dir, dirs[0].name);
  }
  return dir;
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
export async function extractZipToContentRoot(zipPath: string): Promise<{
  contentRoot: string;
  tempDir: string;
}> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "montahd-"));
  await extract(zipPath, { dir: tempDir });
  const contentRoot = await detectContentRoot(tempDir);
  return { contentRoot, tempDir };
}

export async function removeTempDir(tempDir: string): Promise<void> {
  await rm(tempDir, { recursive: true, force: true });
}
