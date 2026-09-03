import { app, type BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

export type AppUpdatePayload = {
  status: "available" | "ready";
  version: string;
};

/** Checa latest.yml em https://montahd.vercel.app/downloads (build.publish). */
export function startAutoUpdate(getWindow: () => BrowserWindow | null): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // Builds atuais não têm Authenticode; sem isso o update é recusado em silêncio.
  (autoUpdater as unknown as { verifyUpdateCodeSignature: boolean }).verifyUpdateCodeSignature =
    false;

  const send = (payload: AppUpdatePayload) => {
    getWindow()?.webContents.send("app-update", payload);
  };

  autoUpdater.on("update-available", (info) => {
    send({ status: "available", version: info.version });
  });
  autoUpdater.on("update-downloaded", (info) => {
    send({ status: "ready", version: info.version });
  });
  autoUpdater.on("error", () => {
    // Sem latest.yml ou sem rede: o app segue normal.
  });

  void autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
}

export function installDownloadedUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}
