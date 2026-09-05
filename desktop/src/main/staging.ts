import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import * as fsPromises from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { mkdir, rm } = fsPromises;

type StatFsFn = (target: string) => Promise<{
  bavail: number | bigint;
  bsize: number | bigint;
}>;

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

/** `C:` a partir de `C:\Games` — usado no fallback do Windows 7 (sem `statfs`). */
export function windowsDriveDeviceId(dir: string): string {
  return path.parse(path.resolve(dir)).root.replace(/[\\/]/g, "");
}

function getStatFs(): StatFsFn | undefined {
  const candidate = (fsPromises as { statfs?: StatFsFn }).statfs;
  return typeof candidate === "function" ? candidate : undefined;
}

async function getFreeBytesViaWmic(dir: string): Promise<number> {
  const device = windowsDriveDeviceId(dir);
  const { stdout } = await execFileAsync(
    "wmic",
    ["logicaldisk", "where", `DeviceID='${device}'`, "get", "FreeSpace", "/value"],
    { windowsHide: true, timeout: 15_000 },
  );
  const match = stdout.match(/FreeSpace=(\d+)/);
  if (!match) throw new Error("wmic não devolveu FreeSpace.");
  return Number(match[1]);
}

async function getFreeBytesViaPowerShell(dir: string): Promise<number> {
  const letter = windowsDriveDeviceId(dir).replace(":", "");
  const { stdout } = await execFileAsync(
    "powershell",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `(New-Object -ComObject Scripting.FileSystemObject).GetDrive('${letter}').AvailableSpace`,
    ],
    { windowsHide: true, timeout: 15_000 },
  );
  const value = Number(stdout.trim());
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("PowerShell não devolveu o espaço livre.");
  }
  return value;
}

export async function getFreeBytes(dir: string): Promise<number> {
  const target = existingAncestor(dir);
  const statfs = getStatFs();
  if (statfs) {
    const stats = await statfs(target);
    return Number(stats.bavail) * Number(stats.bsize);
  }

  if (process.platform === "win32") {
    try {
      return await getFreeBytesViaWmic(target);
    } catch {
      return getFreeBytesViaPowerShell(target);
    }
  }

  throw new Error("Não foi possível medir o espaço livre neste sistema.");
}

export async function removeStagingEntry(dir: string): Promise<void> {
  if (!existsSync(dir)) return;
  await rm(dir, { recursive: true, force: true });
}
