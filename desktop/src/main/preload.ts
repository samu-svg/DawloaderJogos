import { contextBridge, ipcRenderer } from "electron";
import type { CatalogLaunch } from "../shared/catalog-launch";
import type { Manifest, ResolvedManifestEntry } from "../shared/manifest";

export interface DownloadProgressEvent {
  entryId: string;
  label: string;
  downloadedBytes: number;
  totalBytes: number;
  status: "downloading" | "verifying" | "extracting" | "installing" | "done" | "error";
  error?: string;
}

const api = {
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke("select-folder"),
  fetchManifest: (baseUrl: string, slug: string, manifestToken?: string): Promise<Manifest> =>
    ipcRenderer.invoke("fetch-manifest", { baseUrl, slug, manifestToken }),
  consumeCatalogLaunch: (): Promise<CatalogLaunch | null> =>
    ipcRenderer.invoke("consume-catalog-launch"),
  startDownload: (rootDir: string, entries: ResolvedManifestEntry[]) =>
    ipcRenderer.invoke("start-download", { rootDir, entries }),
  cancelDownload: (): Promise<void> => ipcRenderer.invoke("cancel-download"),
  onDownloadProgress: (callback: (event: DownloadProgressEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: DownloadProgressEvent) =>
      callback(payload);
    ipcRenderer.on("download-progress", listener);
    return () => ipcRenderer.removeListener("download-progress", listener);
  },
  onCatalogLaunch: (callback: (launch: CatalogLaunch) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: CatalogLaunch) =>
      callback(payload);
    ipcRenderer.on("catalog-launch", listener);
    return () => ipcRenderer.removeListener("catalog-launch", listener);
  },
  onDownloadComplete: (
    callback: (payload: {
      results: { entryId: string; ok: boolean; error?: string }[];
    }) => void,
  ) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      payload: { results: { entryId: string; ok: boolean; error?: string }[] },
    ) => callback(payload);
    ipcRenderer.on("download-complete", listener);
    return () => ipcRenderer.removeListener("download-complete", listener);
  },
};

contextBridge.exposeInMainWorld("montahd", api);

export type MontaHDApi = typeof api;
