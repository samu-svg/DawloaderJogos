import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";

const MAX_BYTES = 512 * 1024;

let logFile: string | null = null;

export function initDebugLog(userDataDir: string): string {
  mkdirSync(userDataDir, { recursive: true });
  logFile = path.join(userDataDir, "montahd.log");
  return logFile;
}

/** Log de suporte: deep link, IPC de abertura e erros do renderer. */
export function debugLog(message: string): void {
  if (!logFile) return;
  try {
    try {
      if (statSync(logFile).size > MAX_BYTES) {
        renameSync(logFile, `${logFile}.old`);
      }
    } catch {
      // arquivo ainda não existe
    }
    appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch {
    // log nunca pode derrubar o app
  }
}
