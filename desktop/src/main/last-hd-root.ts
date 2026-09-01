import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const FILE_NAME = "last-hd-root.json";

export function lastHdRootFile(userData: string): string {
  return path.join(userData, FILE_NAME);
}

export function saveLastHdRoot(userData: string, rootDir: string): string {
  const resolved = path.resolve(rootDir);
  writeFileSync(
    lastHdRootFile(userData),
    `${JSON.stringify({ rootDir: resolved })}\n`,
    "utf8",
  );
  return resolved;
}

export function loadLastHdRoot(userData: string): string | null {
  try {
    const raw = readFileSync(lastHdRootFile(userData), "utf8");
    const parsed = JSON.parse(raw) as { rootDir?: unknown };
    if (typeof parsed.rootDir !== "string" || !parsed.rootDir.trim()) return null;
    const resolved = path.resolve(parsed.rootDir);
    if (!existsSync(resolved)) return null;
    return resolved;
  } catch {
    return null;
  }
}
