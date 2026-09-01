import { spawn } from "node:child_process";
import { shell } from "electron";
import {
  assertHttpUrl,
  windowsExplorerOpenCommand,
} from "../shared/http-url";

const OPEN_WAIT_MS = 1500;

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
 * `shell.openExternal` no Windows às vezes não resolve; não esperamos para sempre
 * (senão o botão fica em "Abrindo…"). Se falhar de imediato, cai no explorer.exe.
 */
export async function openExternalUrl(url: string): Promise<void> {
  const safeUrl = assertHttpUrl(url).toString();
  const opening = shell.openExternal(safeUrl);

  const result = await Promise.race([
    opening.then(() => "ok" as const).catch((error: unknown) => error),
    new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), OPEN_WAIT_MS);
    }),
  ]);

  if (result === "ok" || result === "timeout") return;
  if (process.platform !== "win32") {
    throw result;
  }

  const { command, args } = windowsExplorerOpenCommand(safeUrl);
  await spawnDetached(command, args);
}
