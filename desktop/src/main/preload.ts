import { contextBridge, ipcRenderer } from "electron";
import type { CatalogLaunch } from "../shared/catalog-launch";
import type { HdLibraryHint, HdLibraryItem } from "../shared/hd-library";
import type { EntryInstallState } from "../shared/install-state";
import type { Manifest } from "../shared/manifest";
import type { RequestedEntry } from "../shared/trusted-entries";

export interface DownloadProgressEvent {
  entryId: string;
  label: string;
  downloadedBytes: number;
  totalBytes: number;
  status: "downloading" | "verifying" | "extracting" | "installing" | "copying" | "done" | "error";
  target?: "hd" | "pc";
  error?: string;
}

const api = {
  log: (message: string): void => {
    ipcRenderer.send("renderer-log", message);
  },
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke("open-external", url),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("get-app-version"),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke("select-folder"),
  getLastHdRoot: (): Promise<string | null> => ipcRenderer.invoke("get-last-hd-root"),
  computeHdFingerprint: (rootDir: string): Promise<string> =>
    ipcRenderer.invoke("compute-hd-fingerprint", rootDir),
  requestManifestToken: (
    baseUrl: string,
    payload: {
      session?: string;
      slug?: string;
      entryIds?: string[];
      hdFingerprint: string;
    },
  ): Promise<string | null> =>
    ipcRenderer.invoke("request-manifest-token", { baseUrl, ...payload }),
  fetchManifest: (baseUrl: string, slug: string, manifestToken?: string): Promise<Manifest> =>
    ipcRenderer.invoke("fetch-manifest", { baseUrl, slug, manifestToken }),
  consumeCatalogLaunch: (): Promise<CatalogLaunch | null> =>
    ipcRenderer.invoke("consume-catalog-launch"),
  startDownload: (
    rootDir: string,
    entries: RequestedEntry[],
    options?: { resetEntryIds?: string[] },
  ) => ipcRenderer.invoke("start-download", { rootDir, entries, ...options }),
  inspectInstallState: (
    rootDir: string,
    entries: { id: string; label: string; destination: string }[],
  ): Promise<EntryInstallState[]> =>
    ipcRenderer.invoke("inspect-install-state", { rootDir, entries }),
  getPcDiskSpace: (): Promise<{ freeBytes: number; path: string }> =>
    ipcRenderer.invoke("get-pc-disk-space"),
  cancelDownload: (): Promise<void> => ipcRenderer.invoke("cancel-download"),
  listHdLibrary: (rootDir: string, hints?: HdLibraryHint[]): Promise<HdLibraryItem[]> =>
    ipcRenderer.invoke("list-hd-library", { rootDir, hints }),
  rememberHdLabels: (rootDir: string, hints: HdLibraryHint[]): Promise<void> =>
    ipcRenderer.invoke("remember-hd-labels", { rootDir, hints }),
  deleteHdItem: (
    rootDir: string,
    destination: string,
  ): Promise<{ ok: true; alreadyGone?: boolean }> =>
    ipcRenderer.invoke("delete-hd-item", { rootDir, destination }),
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
