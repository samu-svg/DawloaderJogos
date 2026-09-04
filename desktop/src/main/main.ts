import path from "node:path";
import { existsSync } from "node:fs";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import type { CatalogLaunch } from "../shared/catalog-launch";
import {
  findDeepLinkInArgv,
  isAllowedCatalogOrigin,
  parseMontaHDDeepLink,
  requireAllowedCatalogOrigin,
} from "../shared/catalog-launch";
import {
  destinationForPriorityRootInstall,
  isSpecialInstallSlug,
  packSlugFromInstallSlug,
} from "../shared/special-downloads";
import type { Manifest, ResolvedManifestEntry } from "../shared/manifest";
import {
  assertHostedSha256,
  assertManifestNotExpired,
  findDuplicateDestinations,
  validateDestination,
} from "../shared/manifest";
import { assertSafeDownloadUrl } from "../shared/http-url.ts";
import { assertAuthorizedRoot, rememberAuthorizedRoot } from "./authorized-roots";
import { loadLastHdRoot, saveLastHdRoot } from "./last-hd-root";
import { preloadPath, rendererPath } from "./app-paths";
import { registerProtocolClient } from "./register-protocol";
import {
  beginDownloadSession,
  endDownloadSession,
  getActiveDownloadSession,
} from "./download-control";
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
  clearDownloadResidues,
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
import { formatFsError } from "../shared/fs-errors";
import {
  type InstallMode,
  isValidInstallMode,
  largestPcStagingBytes,
  hdSpaceNeeded,
  notEnoughHdSpaceMessage,
  notEnoughPcSpaceMessage,
  peakPcStagingBytes,
} from "../shared/pc-space";
import { loadInstallMode, saveInstallMode } from "./install-mode-store";
import { ensureStagingRoot, getFreeBytes } from "./staging";
import { openExternalUrl } from "./open-external";
import { fetchSameOrigin } from "./safe-fetch";
import { installDownloadedUpdate, startAutoUpdate } from "./auto-update";
import { debugLog, initDebugLog } from "./debug-log";

initDebugLog(app.getPath("userData"));

if (app.isPackaged) {
  registerProtocolClient();
}

function stagingRootPath(): string {
  return path.join(app.getPath("userData"), "staging");
}

let mainWindow: BrowserWindow | null = null;
let pendingCatalogLaunch: CatalogLaunch | null = null;
/** Só entrega o deep link depois que o renderer registrou o listener. */
let rendererReady = false;

/**
 * The entries exactly as the server sent them, indexed by id. `start-download`
 * resolves against this instead of trusting the copy the renderer sends back.
 */
let trustedEntries: ReadonlyMap<string, ResolvedManifestEntry> = new Map();

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function flushCatalogLaunch() {
  if (!pendingCatalogLaunch || !rendererReady) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isDestroyed()) return;

  // Consome aqui: sem isso o renderer recebia o mesmo launch duas vezes
  // (evento + consume-catalog-launch) e a segunda passada abortava a primeira.
  const launch = pendingCatalogLaunch;
  pendingCatalogLaunch = null;
  debugLog(`entrega catalog-launch slug=${launch.slug}`);
  mainWindow.webContents.send("catalog-launch", launch);
}

function deliverCatalogLaunch(launch: CatalogLaunch) {
  pendingCatalogLaunch = launch;
  flushCatalogLaunch();
  focusMainWindow();
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
  debugLog(
    launch
      ? `deep link OK slug=${launch.slug} session=${launch.installSession ? "sim" : "nao"} entries=${launch.entryIds.length}`
      : `deep link RECUSADO: ${rawUrl}`,
  );
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
    width: 1120,
    height: 760,
    minWidth: 900,
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
  mainWindow.webContents.on("did-start-loading", () => {
    rendererReady = false;
  });
  mainWindow.webContents.on("did-finish-load", () => {
    rendererReady = true;
    debugLog("renderer pronto");
    flushCatalogLaunch();
  });

  mainWindow.webContents.on("preload-error", (_event, file, error) => {
    debugLog(`preload-error ${file}: ${error.message}`);
  });

  mainWindow.webContents.on(
    "console-message",
    (_event, level, message, line, sourceId) => {
      debugLog(`renderer[${level}] ${message} (${sourceId}:${line})`);
    },
  );

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

function manifestUrlForSlug(baseUrl: string, slug: string): string {
  const origin = normalizeBaseUrl(baseUrl);
  if (isSpecialInstallSlug(slug)) {
    const packSlug = packSlugFromInstallSlug(slug);
    if (!packSlug) {
      throw new Error("Pack especial inválido.");
    }
    return `${origin}/api/special-downloads/${encodeURIComponent(packSlug)}/manifest`;
  }
  return `${origin}/api/portfolios/${encodeURIComponent(slug)}/manifest`;
}

async function fetchManifest(
  baseUrl: string,
  slug: string,
  manifestToken?: string,
): Promise<Manifest> {
  const url = manifestUrlForSlug(baseUrl, slug);
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
      data.error ?? "Assinatura ativa necessária. Assine em www.montahds.app/assinar.",
    );
  }
  if (!response.ok) {
    throw new Error(
      data.error ?? `Não foi possível autorizar o download (${response.status}).`,
    );
  }

  return data.token ?? null;
}

if (gotSingleInstanceLock) {
  app.on("second-instance", (_event, argv) => {
    debugLog(`second-instance argv=${JSON.stringify(argv.slice(1))}`);
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
    const lastHd = loadLastHdRoot(app.getPath("userData"));
    if (lastHd) rememberAuthorizedRoot(lastHd);

    debugLog(`start argv=${JSON.stringify(process.argv.slice(1))}`);
    const deepLink = findDeepLinkInArgv(process.argv);
    if (deepLink) handleDeepLink(deepLink);

    createWindow();
    startAutoUpdate(() => mainWindow);

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
  debugLog(`open-external pedido: ${url}`);
  if (!isAllowedCatalogOrigin(url, catalogOriginOptions())) {
    debugLog(`open-external RECUSADO (origem): ${url}`);
    throw new Error("URL inválida.");
  }
  try {
    await openExternalUrl(url);
    debugLog("open-external OK");
  } catch (error) {
    debugLog(
      `open-external FALHOU: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
});

ipcMain.handle("get-app-version", (event) => {
  assertTrustedSender(event);
  return app.getVersion();
});

ipcMain.handle("get-pc-disk-space", async (event) => {
  assertTrustedSender(event);
  const stagingRoot = stagingRootPath();
  const freeBytes = await getFreeBytes(stagingRoot);
  return { freeBytes, path: stagingRoot };
});

ipcMain.handle("get-hd-disk-space", async (event, rootDir: unknown) => {
  assertTrustedSender(event);
  if (typeof rootDir !== "string" || !rootDir.trim()) {
    throw new Error("Pasta do HD inválida.");
  }
  const root = assertAuthorizedRoot(rootDir);
  const freeBytes = await getFreeBytes(root);
  return { freeBytes, path: root };
});

ipcMain.handle("install-app-update", (event) => {
  assertTrustedSender(event);
  installDownloadedUpdate();
});

ipcMain.handle("get-install-mode", (event) => {
  assertTrustedSender(event);
  return loadInstallMode(app.getPath("userData"));
});

ipcMain.handle("set-install-mode", (event, mode: unknown) => {
  assertTrustedSender(event);
  if (!isValidInstallMode(mode)) throw new Error("Modo inválido.");
  saveInstallMode(app.getPath("userData"), mode);
  return mode;
});

ipcMain.handle("select-folder", async (event) => {
  assertTrustedSender(event);
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"],
    title: "Escolha a pasta raiz do HD",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const resolved = rememberAuthorizedRoot(result.filePaths[0]);
  saveLastHdRoot(app.getPath("userData"), resolved);
  return resolved;
});

ipcMain.handle("get-last-hd-root", (event) => {
  assertTrustedSender(event);
  const lastRoot = loadLastHdRoot(app.getPath("userData"));
  if (!lastRoot) return null;
  return rememberAuthorizedRoot(lastRoot);
});

ipcMain.handle("hd-root-available", (event, rootDir: string) => {
  assertTrustedSender(event);
  const resolved = assertAuthorizedRoot(rootDir);
  try {
    return existsSync(resolved);
  } catch {
    return false;
  }
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
    },
  ) => {
    assertTrustedSender(event);
    return requestManifestToken(payload.baseUrl, {
      session: payload.session,
      slug: payload.slug,
      entryIds: payload.entryIds,
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

ipcMain.on("renderer-log", (event, message: unknown) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return;
  debugLog(`ui: ${String(message).slice(0, 500)}`);
});

ipcMain.handle("cancel-download", (event) => {
  assertTrustedSender(event);
  getActiveDownloadSession()?.cancelAll();
  endDownloadSession();
});

ipcMain.handle("pause-download-entry", (event, entryId: unknown) => {
  assertTrustedSender(event);
  if (typeof entryId !== "string" || !entryId.trim()) {
    throw new Error("Jogo inválido.");
  }
  getActiveDownloadSession()?.pauseEntry(entryId.trim());
});

ipcMain.handle("pause-all-downloads", (event) => {
  assertTrustedSender(event);
  getActiveDownloadSession()?.pauseAll();
});

ipcMain.handle("cancel-download-entry", (event, entryId: unknown) => {
  assertTrustedSender(event);
  if (typeof entryId !== "string" || !entryId.trim()) {
    throw new Error("Jogo inválido.");
  }
  getActiveDownloadSession()?.cancelEntry(entryId.trim());
});

ipcMain.handle("resume-download-entry", (event, entryId: unknown) => {
  assertTrustedSender(event);
  if (typeof entryId !== "string" || !entryId.trim()) {
    throw new Error("Jogo inválido.");
  }
  const session = getActiveDownloadSession();
  if (!session) return { ok: false };
  return { ok: session.requeue(entryId.trim()) };
});

ipcMain.handle(
  "clear-entry-install-files",
  async (
    event,
    payload: {
      rootDir: string;
      entries: { id: string; destination: string }[];
    },
  ) => {
    assertTrustedSender(event);
    const rootDir = assertAuthorizedRoot(payload.rootDir);
    const stagingRoot = stagingRootPath();
    for (const entry of payload.entries ?? []) {
      if (typeof entry.id !== "string" || typeof entry.destination !== "string") {
        continue;
      }
      await clearEntryInstallFiles({
        rootDir,
        destination: entry.destination,
        entryId: entry.id,
        stagingRoot,
      });
    }
  },
);

ipcMain.handle(
  "fetch-catalog-labels",
  async (event, payload: { baseUrl: string }) => {
    assertTrustedSender(event);
    const origin = normalizeBaseUrl(payload.baseUrl);
    const response = await fetchSameOrigin(`${origin}/api/catalog-labels`);
    if (!response.ok) {
      throw new Error(`Não foi possível carregar nomes do catálogo (${response.status}).`);
    }
    const data = (await response.json()) as {
      labels?: HdLibraryHint[];
      titleIds?: Record<string, string>;
    };
    return {
      labels: Array.isArray(data.labels) ? data.labels : [],
      titleIds:
        data.titleIds && typeof data.titleIds === "object" && !Array.isArray(data.titleIds)
          ? data.titleIds
          : {},
    };
  },
);

ipcMain.handle(
  "list-hd-library",
  async (event, payload: { rootDir: string; hints?: HdLibraryHint[]; titleIds?: Record<string, string> }) => {
    assertTrustedSender(event);
    return listHdLibrary(
      assertAuthorizedRoot(payload.rootDir),
      payload.hints ?? [],
      payload.titleIds ?? {},
    );
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
    endDownloadSession();
    const session = beginDownloadSession();

    const results: { entryId: string; ok: boolean; error?: string; paused?: boolean }[] = [];
    const stagingRoot = stagingRootPath();

    try {

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
      endDownloadSession();
      send("download-complete", { results });
      return { results };
    }

    await removeStaleHdExtractDirs(rootDir).catch(() => undefined);

    const resetIds = new Set(payload.resetEntryIds ?? []);
    for (const entry of requestedEntries) {
      if (!resetIds.has(entry.id)) continue;
      try {
        await clearDownloadResidues({
          rootDir,
          destination: destinationForPriorityRootInstall(entry.id, entry.destination),
          entryId: entry.id,
          stagingRoot,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível preparar a reinstalação.";
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

    const installMode = loadInstallMode(app.getPath("userData"));
    const sizes = entriesToDownload.map((entry) => entry.sizeBytes);
    const needed = peakPcStagingBytes(sizes, installMode) || largestPcStagingBytes(sizes);
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
        endDownloadSession();
        send("download-complete", { results });
        return { results };
      }
    }

    const hdRetained = entriesToDownload
      .filter((entry) => resetIds.has(entry.id))
      .reduce((sum, entry) => sum + (entry.sizeBytes || 0), 0);
    const hdNeeded = hdSpaceNeeded(sizes, installMode, hdRetained);
    if (hdNeeded > 0) {
      const hdFree = await getFreeBytes(rootDir);
      if (hdFree < hdNeeded) {
        const message = notEnoughHdSpaceMessage(hdNeeded, hdFree, hdRetained > 0);
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
        endDownloadSession();
        send("download-complete", { results });
        return { results };
      }
    }

    const pipelineItems: PipelineEntry[] = [];
    for (const entry of entriesToDownload) {
      if (session.isCancelled(entry.id)) {
        results.push({ entryId: entry.id, ok: false, error: "Cancelado." });
        continue;
      }

      const destination = destinationForPriorityRootInstall(entry.id, entry.destination);
      const resolved = resolveUnderRoot(rootDir, destination);
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
      session,
      installMode,
      onProgress: (progress) => send("download-progress", progress),
      onEntryComplete: async (item, result) => {
        if (!result.ok || !result.installedPath) return;
        const installedRel = installedRelativePath(rootDir, result.installedPath);
        if (!installedRel) return;
        await recordInstalled(rootDir, {
          id: item.entry.id,
          label: item.entry.label,
          destination: installedRel,
          group: item.entry.group,
          sizeBytes: item.entry.sizeBytes,
        }).catch(() => undefined);
      },
    });

    for (const result of pipelineResults) {
      if (!result.ok) {
        results.push({
          entryId: result.entryId,
          ok: false,
          error: result.error,
          paused: result.paused,
        });
        continue;
      }
      results.push({ entryId: result.entryId, ok: true });
    }

    endDownloadSession();
    send("download-complete", { results });
    return { results };
    } catch (error) {
      const message = formatFsError(error);
      endDownloadSession();
      const ids = new Set(results.map((item) => item.entryId));
      for (const raw of payload.entries ?? []) {
        const entryId = typeof raw.id === "string" ? raw.id : "";
        if (!entryId || ids.has(entryId)) continue;
        send("download-progress", {
          entryId,
          label: typeof raw.label === "string" ? raw.label : "",
          downloadedBytes: 0,
          totalBytes: 0,
          status: "error",
          error: message,
        } satisfies DownloadProgress);
        results.push({ entryId, ok: false, error: message });
      }
      if (results.length === 0) {
        results.push({ entryId: "", ok: false, error: message });
      }
      send("download-complete", { results });
      return { results };
    }
  },
);
