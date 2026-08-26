import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { copyDirectory } from "./copy-dir";
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
  status: "downloading" | "verifying" | "extracting" | "installing" | "done" | "error";
  error?: string;
}

const PARTIAL_SUFFIX = ".montahd.partial";

function partialPath(finalPath: string): string {
  return finalPath + PARTIAL_SUFFIX;
}

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

/** Folder a zip is expanded into: the destination without the .zip suffix. */
function installDirFor(destPath: string): string {
  return destPath.toLowerCase().endsWith(".zip") ? destPath.slice(0, -4) : destPath;
}

/** Drops the downloaded archive and any partial file — only the extracted folder stays. */
async function removeZipDownloadArtifacts(destPath: string): Promise<void> {
  await unlink(partialPath(destPath)).catch(() => undefined);

  if (!existsSync(destPath)) return;

  try {
    if (statSync(destPath).isFile()) {
      await unlink(destPath);
    }
  } catch {
    // Ignore races if another process touched the path.
  }
}

export async function downloadEntry(options: {
  entryId: string;
  label: string;
  url: string;
  destPath: string;
  hdRoot?: string;
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
    expectedSize = 0,
    expectedSha256,
    onProgress,
    signal,
  } = options;

  mkdirSync(path.dirname(destPath), { recursive: true });

  const tempPath = partialPath(destPath);
  let startAt = existsSync(tempPath) ? statSync(tempPath).size : 0;

  let response = await fetch(url, {
    headers: startAt > 0 ? { Range: `bytes=${startAt}-` } : {},
    signal,
  });

  // A server that ignores Range restarts the file, so the partial is dropped
  // rather than appended to and corrupted.
  if (startAt > 0 && (!response.ok || response.status !== 206)) {
    await unlink(tempPath).catch(() => undefined);
    startAt = 0;
    response = await fetch(url, { signal });
  }

  if (!response.ok || !response.body) {
    throw new Error(`Download falhou (${response.status}).`);
  }

  assertDownloadableResponse(response);

  await writeStream(response.body, tempPath, startAt, entryId, label, expectedSize, onProgress);

  const fileSize = statSync(tempPath).size;
  onProgress({
    entryId,
    label,
    downloadedBytes: fileSize,
    totalBytes: expectedSize || fileSize,
    status: "verifying",
  });

  if (expectedSha256) {
    const actual = await hashFile(tempPath);
    if (actual !== expectedSha256.toLowerCase()) {
      await unlink(tempPath).catch(() => undefined);
      throw new Error("SHA-256 não confere. Arquivo descartado.");
    }
  }

  // Zips are expanded where the file would have been, so the game lands as a
  // folder of real files instead of an archive the person has to open.
  if (await isZipFile(tempPath)) {
    const installDir = installDirFor(destPath);

    onProgress({
      entryId,
      label,
      downloadedBytes: fileSize,
      totalBytes: expectedSize || fileSize,
      status: "extracting",
    });

    const { contentRoot, tempDir } = await extractZipToContentRoot(tempPath, installDir);
    let installed = { filesCopied: 0, bytesCopied: 0 };
    try {
      await mkdir(installDir, { recursive: true });
      const installRel = hdRoot
        ? path.relative(hdRoot, installDir).replace(/\\/g, "/")
        : installDir.replace(/\\/g, "/");
      const copyFilter = isGamesDestination(installRel) ? shouldCopyGameFile : undefined;
      installed = await copyDirectory(
        contentRoot,
        installDir,
        (copied, total) => {
          onProgress({
            entryId,
            label,
            downloadedBytes: copied,
            totalBytes: total,
            status: "installing",
          });
        },
        signal,
        copyFilter,
      );

      if (hdRoot && isGamesDestination(installRel)) {
        const contentTrees = await findContentInstallTrees(tempDir);
        for (const contentTree of contentTrees) {
          const nested = await copyDirectory(
            contentTree,
            path.join(hdRoot, "Content"),
            (copied, total) => {
              onProgress({
                entryId,
                label,
                downloadedBytes: installed.bytesCopied + copied,
                totalBytes: installed.bytesCopied + total,
                status: "installing",
              });
            },
            signal,
          );
          installed.filesCopied += nested.filesCopied;
          installed.bytesCopied += nested.bytesCopied;
        }
      }
    } finally {
      await removeTempDir(tempDir);
      await removeZipDownloadArtifacts(destPath);
    }

    onProgress({
      entryId,
      label,
      downloadedBytes: installed.bytesCopied,
      totalBytes: installed.bytesCopied,
      status: "done",
    });
    return { installedPath: installDir };
  }

  if (existsSync(destPath)) unlinkSync(destPath);
  await rename(tempPath, destPath);

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
