import { app } from "electron";
import { autoUpdater } from "electron-updater";

/** Checa latest.yml em https://montahd.vercel.app/downloads (build.publish). */
export function startAutoUpdate(): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("error", () => {
    // Sem latest.yml ou sem rede: o app segue normal.
  });

  void autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
}
