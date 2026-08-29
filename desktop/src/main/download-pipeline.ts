import path from "node:path";
import type { ResolvedManifestEntry } from "../shared/manifest";
import {
  hasSpaceForPrefetch,
  resolveDownloadTarget,
} from "../shared/pc-space";
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
  installedPath?: string;
  error?: string;
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
    onProgress,
    signal,
  };
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

/**
 * Um download por vez (rede). Extração/cópia em paralelo.
 * Ao terminar um download, o próximo começa na hora se houver espaço —
 * mesmo com extrações anteriores ainda em andamento.
 */
export async function runPipelinedDownloads(
  items: PipelineEntry[],
  options: {
    hdRoot: string;
    stagingRoot: string;
    signal?: AbortSignal;
    onProgress: (progress: DownloadProgress) => void;
  },
): Promise<PipelineResult[]> {
  const results: (PipelineResult | undefined)[] = new Array(items.length);
  const extracts = new Set<Promise<void>>();
  let nextIndex = 0;

  const waitForAnyExtract = async () => {
    if (extracts.size === 0) return;
    await Promise.race(extracts);
  };

  const startExtract = (index: number, prepared: PreparedDownload) => {
    const item = items[index];
    const task = (async () => {
      try {
        const installed = await installPreparedEntry(
          prepared,
          options.onProgress,
          options.signal,
        );
        results[index] = {
          entryId: item.entry.id,
          ok: true,
          installedPath: installed.installedPath,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro na instalação.";
        results[index] = failResult(item, message, options.onProgress);
      }
    })();
    extracts.add(task);
    void task.finally(() => extracts.delete(task));
  };

  const downloadThenExtract = async (index: number) => {
    const item = items[index];
    try {
      const prepared = await prepareDownloadEntry(
        buildPrepareOptions(
          item,
          options.hdRoot,
          options.stagingRoot,
          options.onProgress,
          options.signal,
        ),
      );
      if (options.signal?.aborted) {
        results[index] = failResult(item, "Download cancelado.", options.onProgress);
        return;
      }
      startExtract(index, prepared);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro no download.";
      results[index] = failResult(item, message, options.onProgress);
    }
  };

  while (nextIndex < items.length && !options.signal?.aborted) {
    const pending = items[nextIndex];
    const hasSpace = await canPrefetchDownload(
      pending.entry.sizeBytes ?? 0,
      options.hdRoot,
      options.stagingRoot,
    );

    if (!hasSpace && extracts.size > 0) {
      await waitForAnyExtract();
      continue;
    }

    await downloadThenExtract(nextIndex);
    nextIndex += 1;
  }

  await Promise.all([...extracts]);

  return items.map((item, index) => {
    if (results[index]) return results[index]!;
    const message = options.signal?.aborted
      ? "Download cancelado."
      : "Instalação não concluída.";
    return failResult(item, message, options.onProgress);
  });
}

export function installedRelativePath(hdRoot: string, installedPath: string): string | null {
  const installedRel = path.relative(hdRoot, installedPath).replace(/\\/g, "/");
  if (!installedRel || installedRel.startsWith("..") || path.isAbsolute(installedRel)) {
    return null;
  }
  return installedRel;
}
