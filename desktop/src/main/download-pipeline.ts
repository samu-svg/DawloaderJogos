import path from "node:path";
import { formatFsError } from "../shared/fs-errors";
import type { ResolvedManifestEntry } from "../shared/manifest";
import {
  DEFAULT_INSTALL_MODE,
  type InstallMode,
  hasSpaceForPrefetch,
  maxConcurrentExtracts,
  orderDownloadQueue,
  resolveDownloadTarget,
} from "../shared/pc-space";
import {
  isPriorityRootInstall,
  orderPriorityRootInstallFirst,
} from "../shared/special-downloads";
import type { DownloadSession } from "./download-control";
import {
  installPreparedEntry,
  prepareDownloadEntry,
  type DownloadProgress,
  type PreparedDownload,
} from "./download";
import { getFreeBytes } from "./staging";

export interface PipelineEntry {
  entry: ResolvedManifestEntry;
  destPath: string;
}

export interface PipelineResult {
  entryId: string;
  ok: boolean;
  paused?: boolean;
  installedPath?: string;
  error?: string;
}

/** Prioridade na raiz (ex.: AbadAvatar) primeiro; depois HD direto; por último via PC. */
export function sortPipelineEntries(items: PipelineEntry[]): PipelineEntry[] {
  const ordered = orderDownloadQueue(items, (item) => item.entry.sizeBytes ?? 0);
  return orderPriorityRootInstallFirst(ordered, (item) => item.entry.id);
}

export async function canPrefetchDownload(
  catalogSize: number,
  hdRoot: string,
  stagingRoot: string,
): Promise<boolean> {
  const target = resolveDownloadTarget(catalogSize);
  const diskRoot = target === "hd" ? hdRoot : stagingRoot;
  const freeBytes = await getFreeBytes(diskRoot);
  return hasSpaceForPrefetch(freeBytes, catalogSize);
}

function buildPrepareOptions(
  item: PipelineEntry,
  hdRoot: string,
  stagingRoot: string,
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
) {
  return {
    entryId: item.entry.id,
    label: item.entry.label,
    url: item.entry.downloadUrl,
    destPath: item.destPath,
    hdRoot,
    stagingRoot,
    expectedSize: item.entry.sizeBytes,
    expectedSha256: item.entry.sha256,
    kind: item.entry.kind,
    onProgress,
    signal,
  };
}

function pausedResult(
  item: PipelineEntry,
  onProgress: (progress: DownloadProgress) => void,
): PipelineResult {
  onProgress({
    entryId: item.entry.id,
    label: item.entry.label,
    downloadedBytes: 0,
    totalBytes: item.entry.sizeBytes,
    status: "error",
    error: "Pausado",
  });
  return { entryId: item.entry.id, ok: false, paused: true, error: "Pausado" };
}

function failResult(
  item: PipelineEntry,
  message: string,
  onProgress: (progress: DownloadProgress) => void,
): PipelineResult {
  onProgress({
    entryId: item.entry.id,
    label: item.entry.label,
    downloadedBytes: 0,
    totalBytes: item.entry.sizeBytes,
    status: "error",
    error: message,
  });
  return { entryId: item.entry.id, ok: false, error: message };
}

function resolveFailure(
  session: DownloadSession,
  item: PipelineEntry,
  onProgress: (progress: DownloadProgress) => void,
  fallback: string,
): PipelineResult {
  if (session.isCancelled(item.entry.id)) {
    return failResult(item, "Cancelado.", onProgress);
  }
  if (session.isPaused(item.entry.id)) {
    return pausedResult(item, onProgress);
  }
  return failResult(item, fallback, onProgress);
}

/**
 * Um download por vez (rede). Extração/cópia limitada pelo installMode.
 * - economico / pouco espaço: 1 extract; próximo download espera o extract terminar.
 * - equilibrado (padrão): até 2 extracts concorrentes.
 * - rapido: até 5 extracts concorrentes antes do próximo download.
 */
export async function runPipelinedDownloads(
  items: PipelineEntry[],
  options: {
    hdRoot: string;
    stagingRoot: string;
    session: DownloadSession;
    installMode?: InstallMode;
    onProgress: (progress: DownloadProgress) => void;
    onEntryComplete?: (
      item: PipelineEntry,
      result: PipelineResult,
    ) => Promise<void>;
  },
): Promise<PipelineResult[]> {
  const queue = [...items];
  options.session.registerItems(queue);
  const results: (PipelineResult | undefined)[] = new Array(queue.length);
  const extracts = new Set<Promise<void>>();
  const maxExtracts = maxConcurrentExtracts(options.installMode ?? DEFAULT_INSTALL_MODE);
  let nextIndex = 0;

  const drainExtras = () => {
    while (options.session.extraQueue.length > 0) {
      const extra = options.session.extraQueue.shift();
      if (!extra) break;
      queue.push(extra);
      results.push(undefined);
    }
  };

  const waitForAnyExtract = async () => {
    if (extracts.size === 0) return;
    await Promise.race(extracts);
  };

  const startExtract = (
    index: number,
    prepared: PreparedDownload,
    entrySignal: AbortSignal,
  ): Promise<void> => {
    const item = queue[index];
    const task = (async () => {
      try {
        const installed = await installPreparedEntry(
          prepared,
          options.onProgress,
          entrySignal,
        );
        if (options.session.isCancelled(item.entry.id)) {
          results[index] = failResult(item, "Cancelado.", options.onProgress);
          return;
        }
        if (options.session.isPaused(item.entry.id)) {
          results[index] = pausedResult(item, options.onProgress);
          return;
        }
        const result: PipelineResult = {
          entryId: item.entry.id,
          ok: true,
          installedPath: installed.installedPath,
        };
        if (options.onEntryComplete) {
          await options.onEntryComplete(item, result);
        }
        options.onProgress({
          entryId: item.entry.id,
          label: item.entry.label,
          downloadedBytes: item.entry.sizeBytes,
          totalBytes: item.entry.sizeBytes,
          status: "done",
          target: prepared.target,
        });
        results[index] = result;
      } catch (error) {
        results[index] = resolveFailure(
          options.session,
          item,
          options.onProgress,
          error instanceof Error ? error.message : "Erro na instalação.",
        );
      } finally {
        options.session.clearEntry(item.entry.id);
      }
    })();
    extracts.add(task);
    void task.finally(() => extracts.delete(task));
    return task;
  };

  const downloadThenExtract = async (index: number) => {
    const item = queue[index];
    const entrySignal = options.session.signalFor(item.entry.id);
    try {
      const prepared = await prepareDownloadEntry(
        buildPrepareOptions(
          item,
          options.hdRoot,
          options.stagingRoot,
          options.onProgress,
          entrySignal,
        ),
      );
      if (options.session.isCancelled(item.entry.id)) {
        results[index] = failResult(item, "Cancelado.", options.onProgress);
        options.session.clearEntry(item.entry.id);
        return;
      }
      if (options.session.isPaused(item.entry.id)) {
        results[index] = pausedResult(item, options.onProgress);
        options.session.clearEntry(item.entry.id);
        return;
      }
      const extractTask = startExtract(index, prepared, entrySignal);
      if (isPriorityRootInstall(item.entry.id)) {
        await extractTask;
      }
    } catch (error) {
      results[index] = resolveFailure(
        options.session,
        item,
        options.onProgress,
        error instanceof Error ? error.message : "Erro no download.",
      );
      options.session.clearEntry(item.entry.id);
    }
  };

  while (true) {
    drainExtras();
    if (options.session.queueBlocked) break;
    if (nextIndex >= queue.length) {
      if (extracts.size > 0) {
        await waitForAnyExtract();
        continue;
      }
      break;
    }

    const pending = queue[nextIndex];
    if (options.session.isCancelled(pending.entry.id)) {
      results[nextIndex] = failResult(pending, "Cancelado.", options.onProgress);
      nextIndex += 1;
      continue;
    }
    if (options.session.isPaused(pending.entry.id)) {
      results[nextIndex] = pausedResult(pending, options.onProgress);
      nextIndex += 1;
      continue;
    }

    let hasSpace: boolean;
    try {
      hasSpace = await canPrefetchDownload(
        pending.entry.sizeBytes ?? 0,
        options.hdRoot,
        options.stagingRoot,
      );
    } catch (error) {
      const message = formatFsError(error);
      for (let i = nextIndex; i < queue.length; i += 1) {
        results[i] = failResult(queue[i], message, options.onProgress);
      }
      break;
    }

    if (!hasSpace && extracts.size > 0) {
      await waitForAnyExtract();
      continue;
    }

    if (extracts.size >= maxExtracts) {
      await waitForAnyExtract();
      continue;
    }

    await downloadThenExtract(nextIndex);
    nextIndex += 1;
  }

  await Promise.all([...extracts]);
  drainExtras();

  const byId = new Map<string, PipelineResult>();
  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    const existing = results[index];
    const result = existing
      ? existing
      : options.session.isCancelled(item.entry.id)
        ? failResult(item, "Cancelado.", options.onProgress)
        : options.session.isPaused(item.entry.id) || options.session.queueBlocked
          ? pausedResult(item, options.onProgress)
          : failResult(item, "Instalação não concluída.", options.onProgress);
    byId.set(result.entryId, result);
  }
  return [...byId.values()];
}

export function installedRelativePath(hdRoot: string, installedPath: string): string | null {
  const installedRel = path.relative(hdRoot, installedPath).replace(/\\/g, "/");
  if (!installedRel || installedRel.startsWith("..") || path.isAbsolute(installedRel)) {
    return null;
  }
  return installedRel;
}
