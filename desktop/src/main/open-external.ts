import { spawn } from "node:child_process";
import { shell } from "electron";

/** Abre URL no navegador padrão sem travar o processo principal (Windows). */
export async function openExternalUrl(url: string): Promise<void> {
  if (process.platform === "win32") {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("cmd", ["/c", "start", "", url], {
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
    return;
  }

  await shell.openExternal(url);
}
