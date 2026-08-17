import { contextBridge, ipcRenderer } from "electron";
import type { Manifest, ResolvedManifestEntry } from "../shared/manifest";

export interface DownloadProgressEvent {
  entryId: string;
  label: string;
  downloadedBytes: number;
  totalBytes: number;
  status: "downloading" | "verifying" | "extracting" | "importing" | "done" | "error";
  error?: string;
}

const api = {
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke("select-folder"),
  selectZipFile: (): Promise<string | null> => ipcRenderer.invoke("select-zip-file"),
  openExternalUrl: (url: string): Promise<void> =>
    ipcRenderer.invoke("open-external-url", url),
  fetchManifest: (baseUrl: string, slug: string): Promise<Manifest> =>
    ipcRenderer.invoke("fetch-manifest", { baseUrl, slug }),
  startDownload: (rootDir: string, entries: ResolvedManifestEntry[]) =>
    ipcRenderer.invoke("start-download", { rootDir, entries }),
  importLocalPackage: (payload: {
    rootDir: string;
    sourcePath: string;
    entryId: string;
    label: string;
    destination: string;
  }) => ipcRenderer.invoke("import-local-package", payload),
  cancelDownload: (): Promise<void> => ipcRenderer.invoke("cancel-download"),
  onDownloadProgress: (callback: (event: DownloadProgressEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: DownloadProgressEvent) =>
      callback(payload);
    ipcRenderer.on("download-progress", listener);
    return () => ipcRenderer.removeListener("download-progress", listener);
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

contextBridge.exposeInMainWorld("dawloader", api);

export type DawloaderApi = typeof api;
