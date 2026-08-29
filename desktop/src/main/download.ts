import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { copyFile, mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { formatFsError } from "../shared/fs-errors";
import { isOverFat32Limit } from "../shared/pc-space";
import { copyDirectory } from "./copy-dir";
import { removeStagingEntry, stagingEntryDir } from "./staging";
import {
  extractZipToContentRoot,
  findContentInstallTrees,
  isGamesDestination,
  isZipFile,
  removeTempDir,
  shouldCopyGameFile,
} from "./zip-extract";

export interface DownloadProgress {
  entryId: string;
  label: string;
  downloadedBytes: number;
  totalBytes: number;
  status:
    | "downloading"
    | "verifying"
    | "extracting"
    | "installing"
    | "copying"
    | "done"
    | "error";
  error?: string;
}

const PARTIAL_NAME = "download.partial";

/**
 * Share pages answer with HTML instead of bytes, which would otherwise be saved
 * as a corrupt "game" file. The link has to serve the file itself.
 */
function assertDownloadableResponse(response: Response): void {
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.startsWith("text/html") || contentType.startsWith("application/xhtml")) {
    throw new Error(
      "Este link abre uma página, não o arquivo. Cadastre um link direto que baixe o arquivo.",
    );
  }
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    let position = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
  } finally {
    await handle.close();
  }
  return hash.digest("hex");
}

/** Folder a zip is expanded into on the HD: the destination without the .zip suffix. */
function installDirFor(destPath: string): string {
  return destPath.toLowerCase().endsWith(".zip") ? destPath.slice(0, -4) : destPath;
}

export async function downloadEntry(options: {
  entryId: string;
  label: string;
  url: string;
  destPath: string;
  hdRoot: string;
  stagingRoot: string;
  expectedSize?: number;
  expectedSha256?: string;
  onProgress: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}): Promise<{ installedPath: string }> {
  const stagingDir = stagingEntryDir(options.stagingRoot, options.entryId);
  mkdirSync(stagingDir, { recursive: true });

  try {
    return await downloadEntryInner({ ...options, stagingDir });
  } catch (error) {
    throw new Error(formatFsError(error));
  }
}

async function downloadEntryInner(options: {
  entryId: string;
  label: string;
  url: string;
  destPath: string;
  hdRoot: string;
  stagingDir: string;
  expectedSize?: number;
  expectedSha256?: string;
  onProgress: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}): Promise<{ installedPath: string }> {
  const {
    entryId,
    label,
    url,
    destPath,
    hdRoot,
    stagingDir,
    expectedSize = 0,
    expectedSha256,
    onProgress,
    signal,
  } = options;

  const zipPartial = path.join(stagingDir, PARTIAL_NAME);
  let startAt = existsSync(zipPartial) ? statSync(zipPartial).size : 0;

  let response = await fetch(url, {
    headers: startAt > 0 ? { Range: `bytes=${startAt}-` } : {},
    signal,
  });

  if (startAt > 0 && (!response.ok || response.status !== 206)) {
    await unlink(zipPartial).catch(() => undefined);
    startAt = 0;
    response = await fetch(url, { signal });
  }

  if (!response.ok || !response.body) {
    throw new Error(`Download falhou (${response.status}).`);
  }

  assertDownloadableResponse(response);

  await writeStream(response.body, zipPartial, startAt, entryId, label, expectedSize, onProgress);

  const fileSize = statSync(zipPartial).size;
  onProgress({
    entryId,
    label,
    downloadedBytes: fileSize,
    totalBytes: expectedSize || fileSize,
    status: "verifying",
  });

  if (expectedSha256) {
    const actual = await hashFile(zipPartial);
    if (actual !== expectedSha256.toLowerCase()) {
      await unlink(zipPartial).catch(() => undefined);
      throw new Error("SHA-256 não confere. Arquivo descartado.");
    }
  }

  const hdInstallDir = installDirFor(destPath);
  let copiedToHd = false;

  if (await isZipFile(zipPartial)) {
    onProgress({
      entryId,
      label,
      downloadedBytes: fileSize,
      totalBytes: expectedSize || fileSize,
      status: "extracting",
    });

    const { contentRoot, tempDir } = await extractZipToContentRoot(
      zipPartial,
      hdInstallDir,
      stagingDir,
    );

    try {
      await mkdir(hdInstallDir, { recursive: true });
      const installRel = path.relative(hdRoot, hdInstallDir).replace(/\\/g, "/");
      const copyFilter = isGamesDestination(installRel) ? shouldCopyGameFile : undefined;

      onProgress({
        entryId,
        label,
        downloadedBytes: 0,
        totalBytes: expectedSize || fileSize,
        status: "copying",
      });

      const installed = await copyDirectory(
        contentRoot,
        hdInstallDir,
        (copied, total) => {
          onProgress({
            entryId,
            label,
            downloadedBytes: copied,
            totalBytes: total,
            status: "copying",
          });
        },
        signal,
        copyFilter,
      );

      if (isGamesDestination(installRel)) {
        const contentTrees = await findContentInstallTrees(tempDir);
        for (const contentTree of contentTrees) {
          await copyDirectory(
            contentTree,
            path.join(hdRoot, "Content"),
            (copied, total) => {
              onProgress({
                entryId,
                label,
                downloadedBytes: installed.bytesCopied + copied,
                totalBytes: installed.bytesCopied + total,
                status: "copying",
              });
            },
            signal,
          );
        }
      }

      copiedToHd = true;
      onProgress({
        entryId,
        label,
        downloadedBytes: installed.bytesCopied,
        totalBytes: installed.bytesCopied,
        status: "done",
      });
      return { installedPath: hdInstallDir };
    } finally {
      await removeTempDir(tempDir);
      if (copiedToHd) {
        await removeStagingEntry(stagingDir);
      }
    }
  }

  if (isOverFat32Limit(fileSize)) {
    throw new Error(
      "Este arquivo tem mais de 4 GB e o HD do Xbox 360 (FAT32) não aceita um único arquivo desse tamanho. Use um pacote zip que extraia em vários arquivos menores.",
    );
  }

  await mkdir(path.dirname(destPath), { recursive: true });
  if (existsSync(destPath)) unlinkSync(destPath);
  await copyFile(zipPartial, destPath);
  copiedToHd = true;
  await removeStagingEntry(stagingDir);

  onProgress({
    entryId,
    label,
    downloadedBytes: fileSize,
    totalBytes: expectedSize || fileSize,
    status: "done",
  });
  return { installedPath: destPath };
}

async function writeStream(
  body: ReadableStream<Uint8Array>,
  filePath: string,
  startAt: number,
  entryId: string,
  label: string,
  expectedSize: number,
  onProgress: (progress: DownloadProgress) => void,
): Promise<void> {
  const nodeStream = Readable.fromWeb(
    body as unknown as import("stream/web").ReadableStream,
  );
  const fileStream = createWriteStream(filePath, { flags: startAt > 0 ? "a" : "w" });
  let downloaded = startAt;

  nodeStream.on("data", (chunk: Buffer) => {
    downloaded += chunk.length;
    onProgress({
      entryId,
      label,
      downloadedBytes: downloaded,
      totalBytes: expectedSize || downloaded,
      status: "downloading",
    });
  });

  await pipeline(nodeStream, fileStream);
}
