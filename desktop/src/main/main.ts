import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import type { Manifest, ResolvedManifestEntry } from "../shared/manifest";
import {
  findDuplicateDestinations,
  validateDestination,
} from "../shared/manifest";
import { downloadEntry, type DownloadProgress } from "./download";
import { resolveUnderRoot } from "./paths";

let mainWindow: BrowserWindow | null = null;
let abortController: AbortController | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 720,
    minHeight: 560,
    title: "Dawloader",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../../renderer/index.html"));
}

function send(channel: string, payload: unknown) {
  mainWindow?.webContents.send(channel, payload);
}

function normalizeBaseUrl(input: string): string {
  return input.replace(/\/+$/, "");
}

async function fetchManifest(baseUrl: string, slug: string): Promise<Manifest> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/portfolios/${encodeURIComponent(slug)}/manifest`;
  const response = await fetch(url);
  if (response.status === 404) {
    throw new Error("Portfólio não encontrado ou não está público.");
  }
  if (!response.ok) {
    throw new Error(`Não foi possível carregar o manifesto (${response.status}).`);
  }
  const manifest = (await response.json()) as Manifest;

  const duplicates = findDuplicateDestinations(manifest.entries);
  if (duplicates.length > 0) {
    throw new Error(
      `Manifesto inválido: destinos duplicados (${duplicates.join(", ")}).`,
    );
  }

  for (const entry of manifest.entries) {
    const pathCheck = validateDestination(entry.destination);
    if (!pathCheck.ok) {
      throw new Error(`Destino inválido em "${entry.label}": ${pathCheck.error}`);
    }
  }

  return manifest;
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"],
    title: "Escolha a pasta raiz do HD",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle(
  "fetch-manifest",
  async (_event, payload: { baseUrl: string; slug: string }) => {
    return fetchManifest(payload.baseUrl, payload.slug);
  },
);

ipcMain.handle("cancel-download", () => {
  abortController?.abort();
  abortController = null;
});

ipcMain.handle(
  "start-download",
  async (
    _event,
    payload: {
      rootDir: string;
      entries: ResolvedManifestEntry[];
    },
  ) => {
    abortController?.abort();
    abortController = new AbortController();
    const signal = abortController.signal;

    const results: { entryId: string; ok: boolean; error?: string }[] = [];

    for (const entry of payload.entries) {
      if (signal.aborted) break;

      const resolved = resolveUnderRoot(payload.rootDir, entry.destination);
      if (!resolved.ok) {
        send("download-progress", {
          entryId: entry.id,
          label: entry.label,
          downloadedBytes: 0,
          totalBytes: entry.sizeBytes,
          status: "error",
          error: resolved.error,
        } satisfies DownloadProgress);
        results.push({ entryId: entry.id, ok: false, error: resolved.error });
        continue;
      }

      try {
        await downloadEntry({
          entryId: entry.id,
          label: entry.label,
          url: entry.downloadUrl,
          destPath: resolved.fullPath,
          expectedSize: entry.sizeBytes,
          expectedSha256: entry.sha256,
          signal,
          onProgress: (progress) => send("download-progress", progress),
        });
        results.push({ entryId: entry.id, ok: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro desconhecido no download.";
        send("download-progress", {
          entryId: entry.id,
          label: entry.label,
          downloadedBytes: 0,
          totalBytes: entry.sizeBytes,
          status: "error",
          error: message,
        } satisfies DownloadProgress);
        results.push({ entryId: entry.id, ok: false, error: message });
        if (signal.aborted) break;
      }
    }

    abortController = null;
    send("download-complete", { results });
    return { results };
  },
);
