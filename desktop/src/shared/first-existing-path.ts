import { existsSync } from "node:fs";

/** Primeiro caminho que existe no disco (ou dentro do asar, no Electron). */
export function firstExistingPath(candidates: string[]): string {
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return candidates[0] ?? "";
}
