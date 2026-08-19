import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import type { CatalogLaunch } from "../shared/catalog-launch";
import {
  findDeepLinkInArgv,
  parseMontaHDDeepLink,
} from "../shared/catalog-launch";
import type { Manifest, ResolvedManifestEntry } from "../shared/manifest";
import {
  findDuplicateDestinations,
  validateDestination,
} from "../shared/manifest";
import { preloadPath, rendererPath } from "./app-paths";
import { downloadEntry, type DownloadProgress } from "./download";
import { resolveUnderRoot } from "./paths";

const PROTOCOL = "montahd";

let mainWindow: BrowserWindow | null = null;
let abortController: AbortController | null = null;
let pendingCatalogLaunch: CatalogLaunch | null = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function registerProtocolClient() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
      return;
    }
  }

  app.setAsDefaultProtocolClient(PROTOCOL);
}

function deliverCatalogLaunch(launch: CatalogLaunch) {
  pendingCatalogLaunch = launch;

  if (!mainWindow) return;

  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once("did-finish-load", () => {
      mainWindow?.webContents.send("catalog-launch", launch);
    });
  } else {
    mainWindow.webContents.send("catalog-launch", launch);
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function handleDeepLink(rawUrl: string) {
  const launch = parseMontaHDDeepLink(rawUrl);
  if (!launch) return;
  deliverCatalogLaunch(launch);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 740,
    minWidth: 760,
    minHeight: 580,
    title: "MontaHD",
    icon: rendererPath("icon.png"),
    show: false,
    backgroundColor: "#08080f",
    titleBarStyle: "hidden",
    ...(process.platform === "win32"
      ? {
          titleBarOverlay: {
            color: "#08080f",
            symbolColor: "#f4f4f5",
            height: 36,
          },
        }
      : {}),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const indexHtml = rendererPath("index.html");

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      dialog.showErrorBox(
        "MontaHD",
        `Não foi possível carregar a interface (${errorCode}).\n${errorDescription}\n${validatedURL}`,
      );
    },
  );

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  void mainWindow.loadFile(indexHtml).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox(
      "MontaHD",
      `Não foi possível abrir a interface.\n${indexHtml}\n\n${message}`,
    );
  });

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function send(channel: string, payload: unknown) {
  mainWindow?.webContents.send(channel, payload);
}

function normalizeBaseUrl(input: string): string {
  return input.replace(/\/+$/, "");
}

async function fetchManifest(
  baseUrl: string,
  slug: string,
  manifestToken?: string,
): Promise<Manifest> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/portfolios/${encodeURIComponent(slug)}/manifest`;
  const headers: Record<string, string> = {};
  if (manifestToken) {
    headers.Authorization = `Bearer ${manifestToken}`;
  }

  const response = await fetch(url, { headers });
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Assinatura ativa necessária. Abra o catálogo pelo site e clique em Abrir no MontaHD.",
    );
  }
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

if (gotSingleInstanceLock) {
  app.on("second-instance", (_event, argv) => {
    const deepLink = findDeepLinkInArgv(argv);
    if (deepLink) handleDeepLink(deepLink);
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  app.whenReady().then(() => {
    registerProtocolClient();
    createWindow();

    const deepLink = findDeepLinkInArgv(process.argv);
    if (deepLink) handleDeepLink(deepLink);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("open-external", async (_event, rawUrl: string) => {
  const url = rawUrl.trim();
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    throw new Error("URL inválida.");
  }
  await shell.openExternal(url);
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
  async (
    _event,
    payload: { baseUrl: string; slug: string; manifestToken?: string },
  ) => {
    return fetchManifest(payload.baseUrl, payload.slug, payload.manifestToken);
  },
);

ipcMain.handle("consume-catalog-launch", () => {
  const launch = pendingCatalogLaunch;
  pendingCatalogLaunch = null;
  return launch;
});

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
