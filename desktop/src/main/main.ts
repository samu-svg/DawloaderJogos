import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import type { CatalogLaunch } from "../shared/catalog-launch";
import {
  findDeepLinkInArgv,
  isAllowedCatalogOrigin,
  parseMontaHDDeepLink,
  requireAllowedCatalogOrigin,
} from "../shared/catalog-launch";
import type { Manifest, ResolvedManifestEntry } from "../shared/manifest";
import {
  assertHostedSha256,
  assertManifestNotExpired,
  findDuplicateDestinations,
  validateDestination,
} from "../shared/manifest";
import { assertSafeDownloadUrl } from "../shared/http-url";
import { assertAuthorizedRoot, rememberAuthorizedRoot } from "./authorized-roots";
import { preloadPath, rendererPath } from "./app-paths";
import { type DownloadProgress } from "./download";
import {
  installedRelativePath,
  runPipelinedDownloads,
  sortPipelineEntries,
  type PipelineEntry,
} from "./download-pipeline";
import {
  deleteHdItem,
  listHdLibrary,
  rememberHdLabels,
  recordInstalled,
} from "./hd-library";
import {
  clearEntryInstallFiles,
  inspectInstallStates,
  removeStaleHdExtractDirs,
} from "./install-state";
import { resolveUnderRoot } from "./paths";
import { computeHdFingerprint } from "../shared/hd-fingerprint";
import {
  resolveTrustedEntries,
  type RequestedEntry,
} from "../shared/trusted-entries";
import type { HdLibraryHint } from "../shared/hd-library";
import { largestPcStagingBytes, notEnoughPcSpaceMessage } from "../shared/pc-space";
import { ensureStagingRoot, getFreeBytes } from "./staging";
import { openExternalUrl } from "./open-external";
import { fetchSameOrigin } from "./safe-fetch";
import { startAutoUpdate } from "./auto-update";

const PROTOCOL = "montahd";

function stagingRootPath(): string {
  return path.join(app.getPath("userData"), "staging");
}

let mainWindow: BrowserWindow | null = null;
let abortController: AbortController | null = null;
let pendingCatalogLaunch: CatalogLaunch | null = null;

/**
 * The entries exactly as the server sent them, indexed by id. `start-download`
 * resolves against this instead of trusting the copy the renderer sends back.
 */
let trustedEntries: ReadonlyMap<string, ResolvedManifestEntry> = new Map();

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

function catalogOriginOptions() {
  return { allowLocalhost: !app.isPackaged };
}

function assertTrustedSender(event: IpcMainInvokeEvent) {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error("Origem IPC inválida.");
  }
}

function handleDeepLink(rawUrl: string) {
  const launch = parseMontaHDDeepLink(rawUrl, catalogOriginOptions());
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
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  const indexHtml = rendererPath("index.html");

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      // -3 ERR_ABORTED: Chromium cancela about:blank ao ir para o index.html.
      if (errorCode === -3) return;
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
  return requireAllowedCatalogOrigin(input, catalogOriginOptions());
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

  const response = await fetchSameOrigin(url, { headers });
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
  assertManifestNotExpired(manifest.expiresAt);

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
    assertHostedSha256(entry.kind, entry.sha256);
    if (entry.downloadUrl) assertSafeDownloadUrl(entry.downloadUrl);
  }

  trustedEntries = new Map(manifest.entries.map((entry) => [entry.id, entry]));

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
  const response = await fetchSameOrigin(`${normalizeBaseUrl(baseUrl)}/api/manifest-token`, {
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
    startAutoUpdate();

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

ipcMain.handle("open-external", async (event, rawUrl: string) => {
  assertTrustedSender(event);
  const url = rawUrl.trim();
  if (!isAllowedCatalogOrigin(url, catalogOriginOptions())) {
    throw new Error("URL inválida.");
  }
  await openExternalUrl(url);
});

ipcMain.handle("get-pc-disk-space", async (event) => {
  assertTrustedSender(event);
  const stagingRoot = stagingRootPath();
  const freeBytes = await getFreeBytes(stagingRoot);
  return { freeBytes, path: stagingRoot };
});

ipcMain.handle("select-folder", async (event) => {
  assertTrustedSender(event);
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"],
    title: "Escolha a pasta raiz do HD",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return rememberAuthorizedRoot(result.filePaths[0]);
});

ipcMain.handle("compute-hd-fingerprint", (event, rootDir: string) => {
  assertTrustedSender(event);
  return computeHdFingerprint(assertAuthorizedRoot(rootDir));
});

ipcMain.handle(
  "request-manifest-token",
  async (
    event,
    payload: {
      baseUrl: string;
      session?: string;
      slug?: string;
      entryIds?: string[];
      hdFingerprint: string;
    },
  ) => {
    assertTrustedSender(event);
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
    event,
    payload: { baseUrl: string; slug: string; manifestToken?: string },
  ) => {
    assertTrustedSender(event);
    return fetchManifest(payload.baseUrl, payload.slug, payload.manifestToken);
  },
);

ipcMain.handle("consume-catalog-launch", (event) => {
  assertTrustedSender(event);
  const launch = pendingCatalogLaunch;
  pendingCatalogLaunch = null;
  return launch;
});

ipcMain.handle("cancel-download", (event) => {
  assertTrustedSender(event);
  abortController?.abort();
  abortController = null;
});

ipcMain.handle(
  "list-hd-library",
  async (event, payload: { rootDir: string; hints?: HdLibraryHint[] }) => {
    assertTrustedSender(event);
    return listHdLibrary(assertAuthorizedRoot(payload.rootDir), payload.hints ?? []);
  },
);

ipcMain.handle(
  "remember-hd-labels",
  async (event, payload: { rootDir: string; hints: HdLibraryHint[] }) => {
    assertTrustedSender(event);
    await rememberHdLabels(assertAuthorizedRoot(payload.rootDir), payload.hints ?? []);
  },
);

ipcMain.handle(
  "inspect-install-state",
  async (
    event,
    payload: {
      rootDir: string;
      entries: { id: string; label: string; destination: string }[];
    },
  ) => {
    assertTrustedSender(event);
    return inspectInstallStates(
      assertAuthorizedRoot(payload.rootDir),
      payload.entries,
      stagingRootPath(),
    );
  },
);

ipcMain.handle(
  "delete-hd-item",
  async (event, payload: { rootDir: string; destination: string }) => {
    assertTrustedSender(event);
    return deleteHdItem(assertAuthorizedRoot(payload.rootDir), payload.destination);
  },
);

ipcMain.handle(
  "start-download",
  async (
    event,
    payload: {
      rootDir: string;
      /** Untrusted: only `id` and `destination` are read from these. */
      entries: RequestedEntry[];
      resetEntryIds?: string[];
    },
  ) => {
    assertTrustedSender(event);
    const rootDir = assertAuthorizedRoot(payload.rootDir);
    abortController?.abort();
    abortController = new AbortController();
    const signal = abortController.signal;

    const results: { entryId: string; ok: boolean; error?: string }[] = [];
    const stagingRoot = stagingRootPath();

    // The renderer only gets to choose which entries and which destination;
    // url, kind and hash are read back from the manifest this process fetched.
    const { entries: requestedEntries, rejected } = resolveTrustedEntries(
      trustedEntries,
      payload.entries ?? [],
    );

    for (const item of rejected) {
      send("download-progress", {
        entryId: item.entryId,
        label: item.label,
        downloadedBytes: 0,
        totalBytes: 0,
        status: "error",
        error: item.error,
      } satisfies DownloadProgress);
      results.push({ entryId: item.entryId, ok: false, error: item.error });
    }

    if (requestedEntries.length === 0) {
      abortController = null;
      send("download-complete", { results });
      return { results };
    }

    await removeStaleHdExtractDirs(rootDir).catch(() => undefined);

    const resetIds = new Set(payload.resetEntryIds ?? []);
    for (const entry of requestedEntries) {
      if (!resetIds.has(entry.id)) continue;
      try {
        await clearEntryInstallFiles({
          rootDir,
          destination: entry.destination,
          entryId: entry.id,
          stagingRoot,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível apagar a instalação anterior.";
        send("download-progress", {
          entryId: entry.id,
          label: entry.label,
          downloadedBytes: 0,
          totalBytes: entry.sizeBytes,
          status: "error",
          error: message,
        } satisfies DownloadProgress);
        results.push({ entryId: entry.id, ok: false, error: message });
      }
    }
    const entriesToDownload = requestedEntries.filter(
      (entry) => !results.some((item) => item.entryId === entry.id),
    );

    const needed = largestPcStagingBytes(entriesToDownload.map((entry) => entry.sizeBytes));
    if (needed > 0) {
      await ensureStagingRoot(stagingRoot);
      const freeBytes = await getFreeBytes(stagingRoot);
      if (freeBytes < needed) {
        const message = notEnoughPcSpaceMessage(needed, freeBytes);
        for (const entry of entriesToDownload) {
          send("download-progress", {
            entryId: entry.id,
            label: entry.label,
            downloadedBytes: 0,
            totalBytes: entry.sizeBytes,
            status: "error",
            error: message,
          } satisfies DownloadProgress);
          results.push({ entryId: entry.id, ok: false, error: message });
        }
        abortController = null;
        send("download-complete", { results });
        return { results };
      }
    }

    const pipelineItems: PipelineEntry[] = [];
    for (const entry of entriesToDownload) {
      if (signal.aborted) break;

      const resolved = resolveUnderRoot(rootDir, entry.destination);
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

      pipelineItems.push({ entry, destPath: resolved.fullPath });
    }

    const pipelineResults = await runPipelinedDownloads(sortPipelineEntries(pipelineItems), {
      hdRoot: rootDir,
      stagingRoot,
      signal,
      onProgress: (progress) => send("download-progress", progress),
    });

    for (const result of pipelineResults) {
      if (!result.ok) {
        results.push({
          entryId: result.entryId,
          ok: false,
          error: result.error,
        });
        continue;
      }

      const entry = entriesToDownload.find((item) => item.id === result.entryId);
      if (!entry || !result.installedPath) {
        results.push({ entryId: result.entryId, ok: true });
        continue;
      }

      const installedRel = installedRelativePath(rootDir, result.installedPath);
      if (installedRel) {
        await recordInstalled(rootDir, {
          id: entry.id,
          label: entry.label,
          destination: installedRel,
          group: entry.group,
          sizeBytes: entry.sizeBytes,
        }).catch(() => undefined);
      }
      results.push({ entryId: result.entryId, ok: true });
    }

    abortController = null;
    send("download-complete", { results });
    return { results };
  },
);
