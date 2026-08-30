import { spawn } from "node:child_process";
import { shell } from "electron";
import { assertHttpUrl, windowsExternalOpenCommand } from "../shared/http-url";

function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
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
 * No Windows usamos rundll32 (sem cmd/shell) para não bloquear o processo principal —
 * shell.openExternal() travava até o navegador responder (corrigido em v0.5.7).
 * rundll32 recebe a URL como argv isolado, sem interpretar metacaracteres de shell.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (process.platform === "win32") {
    const { command, args } = windowsExternalOpenCommand(url);
    await spawnDetached(command, args);
    return;
  }

  await shell.openExternal(assertHttpUrl(url).toString());
}
