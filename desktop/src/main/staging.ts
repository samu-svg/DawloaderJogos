import { existsSync } from "node:fs";
import { mkdir, rm, statfs } from "node:fs/promises";
import path from "node:path";

export function safeStagingId(entryId: string): string {
  const cleaned = entryId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return cleaned || "entry";
}

export function stagingEntryDir(stagingRoot: string, entryId: string): string {
  return path.join(stagingRoot, safeStagingId(entryId));
}

function isFilesystemRoot(dir: string): boolean {
  const resolved = path.resolve(dir);
  return path.parse(resolved).root === resolved;
}

/** Sobe até a pasta (ou unidade) que já existe — não cria nada no disco. */
export function existingAncestor(dir: string): string {
  let current = path.resolve(dir);
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

export async function ensureStagingRoot(stagingRoot: string): Promise<void> {
  const resolved = path.resolve(stagingRoot);
  if (isFilesystemRoot(resolved)) return;
  await mkdir(resolved, { recursive: true });
}

export async function getFreeBytes(dir: string): Promise<number> {
  const stats = await statfs(existingAncestor(dir));
  return Number(stats.bavail) * Number(stats.bsize);
}

export async function removeStagingEntry(dir: string): Promise<void> {
  if (!existsSync(dir)) return;
  await rm(dir, { recursive: true, force: true });
}
