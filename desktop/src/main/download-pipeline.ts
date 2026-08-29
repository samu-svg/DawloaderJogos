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

interface PrefetchHandle {
  entryId: string;
  promise: Promise<PreparedDownload>;
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

/** Baixa o próximo jogo em paralelo enquanto o anterior extrai/copia para o HD. */
export async function runPipelinedDownloads(
  items: PipelineEntry[],
  options: {
    hdRoot: string;
    stagingRoot: string;
    signal?: AbortSignal;
    onProgress: (progress: DownloadProgress) => void;
  },
): Promise<PipelineResult[]> {
  const results: PipelineResult[] = [];
  let prefetch: PrefetchHandle | null = null;

  for (let index = 0; index < items.length; index += 1) {
    if (options.signal?.aborted) break;

    const item = items[index];
    let prepared: PreparedDownload;

    try {
      if (prefetch?.entryId === item.entry.id) {
        prepared = await prefetch.promise;
        prefetch = null;
      } else {
        prepared = await prepareDownloadEntry(
          buildPrepareOptions(item, options.hdRoot, options.stagingRoot, options.onProgress, options.signal),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro no download.";
      options.onProgress({
        entryId: item.entry.id,
        label: item.entry.label,
        downloadedBytes: 0,
        totalBytes: item.entry.sizeBytes,
        status: "error",
        error: message,
      });
      results.push({ entryId: item.entry.id, ok: false, error: message });
      prefetch = null;
      continue;
    }

    const next = items[index + 1];
    if (next && !options.signal?.aborted) {
      const ok = await canPrefetchDownload(
        next.entry.sizeBytes ?? 0,
        options.hdRoot,
        options.stagingRoot,
      );
      if (ok) {
        prefetch = {
          entryId: next.entry.id,
          promise: prepareDownloadEntry(
            buildPrepareOptions(next, options.hdRoot, options.stagingRoot, options.onProgress, options.signal),
          ),
        };
      } else {
        prefetch = null;
      }
    } else {
      prefetch = null;
    }

    try {
      const installed = await installPreparedEntry(prepared, options.onProgress, options.signal);
      results.push({
        entryId: item.entry.id,
        ok: true,
        installedPath: installed.installedPath,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro na instalação.";
      options.onProgress({
        entryId: item.entry.id,
        label: item.entry.label,
        downloadedBytes: 0,
        totalBytes: item.entry.sizeBytes,
        status: "error",
        error: message,
      });
      results.push({ entryId: item.entry.id, ok: false, error: message });
      prefetch = null;
      if (options.signal?.aborted) break;
    }
  }

  return results;
}

export function installedRelativePath(hdRoot: string, installedPath: string): string | null {
  const installedRel = path.relative(hdRoot, installedPath).replace(/\\/g, "/");
  if (!installedRel || installedRel.startsWith("..") || path.isAbsolute(installedRel)) {
    return null;
  }
  return installedRel;
}
