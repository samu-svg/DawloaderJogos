import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type InstallMode, isValidInstallMode } from "../shared/pc-space";

const FILE_NAME = "install-mode.json";
const DEFAULT_MODE: InstallMode = "economico";

function filePath(userData: string): string {
  return path.join(userData, FILE_NAME);
}

export function loadInstallMode(userData: string): InstallMode {
  try {
    const raw = readFileSync(filePath(userData), "utf8");
    const parsed = JSON.parse(raw) as { mode?: unknown };
    if (isValidInstallMode(parsed.mode)) return parsed.mode;
  } catch {
    // missing file or bad JSON
  }
  return DEFAULT_MODE;
}

export function saveInstallMode(userData: string, mode: InstallMode): void {
  writeFileSync(filePath(userData), `${JSON.stringify({ mode })}\n`, "utf8");
}
