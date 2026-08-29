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
import {
  deleteHdItem,
  listHdLibrary,
  rememberHdLabels,
  recordInstalled,
} from "./hd-library";
import { resolveUnderRoot } from "./paths";
import { computeHdFingerprint } from "../shared/hd-fingerprint";
import type { HdLibraryHint } from "../shared/hd-library";

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

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.center();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 740,
    minWidth: 760,
    minHeight: 580,
    title: "MontaHD",
    icon: rendererPath("icon.png"),
    show: true,
    backgroundColor: "#08080f",
    autoHideMenuBar: true,
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
    focusMainWindow();
  });

  // Alguns builds do Windows não disparam ready-to-show em apps empacotados.
  setTimeout(() => focusMainWindow(), 3000);

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
    let detail =
      "Assinatura ativa necessária. Abra o catálogo pelo site e clique em Instalar no HD.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      // mantém mensagem padrão
    }
    throw new Error(detail);
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

async function requestManifestToken(
  baseUrl: string,
  payload: {
    session?: string;
    slug?: string;
    entryIds?: string[];
    hdFingerprint: string;
  },
): Promise<string | null> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/manifest-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data: { error?: string; token?: string | null } = {};
  try {
    data = (await response.json()) as { error?: string; token?: string | null };
  } catch {
    // resposta não JSON
  }

  if (response.status === 403) {
    throw new Error(
      data.error ?? "Seu plano não permite usar este HD. Use o HD registrado na sua conta.",
    );
  }
  if (!response.ok) {
    throw new Error(
      data.error ?? `Não foi possível autorizar o HD (${response.status}).`,
    );
  }

  return data.token ?? null;
}

if (gotSingleInstanceLock) {
  app.on("second-instance", (_event, argv) => {
    const deepLink = findDeepLinkInArgv(argv);
    if (deepLink) handleDeepLink(deepLink);
    else focusMainWindow();
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

ipcMain.handle("compute-hd-fingerprint", (_event, rootDir: string) => {
  return computeHdFingerprint(rootDir);
});

ipcMain.handle(
  "request-manifest-token",
  async (
    _event,
    payload: {
      baseUrl: string;
      session?: string;
      slug?: string;
      entryIds?: string[];
      hdFingerprint: string;
    },
  ) => {
    return requestManifestToken(payload.baseUrl, {
      session: payload.session,
      slug: payload.slug,
      entryIds: payload.entryIds,
      hdFingerprint: payload.hdFingerprint,
    });
  },
);

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
  "list-hd-library",
  async (_event, payload: { rootDir: string; hints?: HdLibraryHint[] }) => {
    return listHdLibrary(payload.rootDir, payload.hints ?? []);
  },
);

ipcMain.handle(
  "remember-hd-labels",
  async (_event, payload: { rootDir: string; hints: HdLibraryHint[] }) => {
    await rememberHdLabels(payload.rootDir, payload.hints ?? []);
  },
);

ipcMain.handle(
  "delete-hd-item",
  async (_event, payload: { rootDir: string; destination: string }) => {
    return deleteHdItem(payload.rootDir, payload.destination);
  },
);

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
        const downloaded = await downloadEntry({
          entryId: entry.id,
          label: entry.label,
          url: entry.downloadUrl,
          destPath: resolved.fullPath,
          hdRoot: payload.rootDir,
          expectedSize: entry.sizeBytes,
          expectedSha256: entry.sha256,
          signal,
          onProgress: (progress) => send("download-progress", progress),
        });
        const installedRel = path
          .relative(payload.rootDir, downloaded.installedPath)
          .replace(/\\/g, "/");
        if (
          installedRel &&
          !installedRel.startsWith("..") &&
          !path.isAbsolute(installedRel)
        ) {
          await recordInstalled(payload.rootDir, {
            id: entry.id,
            label: entry.label,
            destination: installedRel,
            group: entry.group,
            sizeBytes: entry.sizeBytes,
          }).catch(() => undefined);
        }
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
