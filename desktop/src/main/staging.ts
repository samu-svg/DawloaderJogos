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

export async function ensureStagingRoot(stagingRoot: string): Promise<void> {
  await mkdir(stagingRoot, { recursive: true });
}

export async function getFreeBytes(dir: string): Promise<number> {
  await mkdir(dir, { recursive: true });
  const stats = await statfs(dir);
  return Number(stats.bavail) * Number(stats.bsize);
}

export async function removeStagingEntry(dir: string): Promise<void> {
  if (!existsSync(dir)) return;
  await rm(dir, { recursive: true, force: true });
}
