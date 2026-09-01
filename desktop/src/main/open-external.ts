import { spawn } from "node:child_process";
import { shell } from "electron";
import {
  assertHttpUrl,
  windowsCmdStartOpenCommand,
  windowsExternalOpenCommand,
} from "../shared/http-url";

const OPEN_WAIT_MS = 2500;

function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

/**
 * Abre URL http(s) no navegador padrão.
 * No Windows empacotado, `rundll32 url.dll` e `cmd start` são mais confiáveis que explorer.
 */
export async function openExternalUrl(url: string): Promise<void> {
  const safeUrl = assertHttpUrl(url).toString();

  if (process.platform === "win32") {
    const attempts = [
      () => {
        const rundll = windowsExternalOpenCommand(safeUrl);
        return spawnDetached(rundll.command, rundll.args);
      },
      () => shell.openExternal(safeUrl),
      () => {
        const cmdStart = windowsCmdStartOpenCommand(safeUrl);
        return spawnDetached(cmdStart.command, cmdStart.args);
      },
    ];

    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        await attempt();
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Não foi possível abrir o navegador.");
  }

  const opening = shell.openExternal(safeUrl);
  const result = await Promise.race([
    opening.then(() => "ok" as const).catch((error: unknown) => error),
    new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), OPEN_WAIT_MS);
    }),
  ]);

  if (result === "ok") return;
  if (result === "timeout") {
    throw new Error("O navegador não abriu. Abra o catálogo pelo site no Chrome ou Edge.");
  }
  throw result instanceof Error ? result : new Error("Não foi possível abrir o navegador.");
}
