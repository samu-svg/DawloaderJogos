import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { copyFile, mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { formatFsError } from "../shared/fs-errors";
import {
  isOverFat32Limit,
  resolveDownloadTarget,
  resolveKnownSize,
  type DownloadTarget,
} from "../shared/pc-space";
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
  target?: DownloadTarget;
  error?: string;
}

export interface PreparedDownload {
  entryId: string;
  label: string;
  destPath: string;
  hdRoot: string;
  stagingRoot: string;
  target: DownloadTarget;
  expectedSize: number;
  fileSize: number;
  zipPath: string;
  isZip: boolean;
  stagingDir: string | null;
  expectedSha256?: string;
}

const HD_PARTIAL_SUFFIX = ".montahd.partial";
const STAGING_PARTIAL_NAME = "download.partial";
const HD_EXTRACT_DIR = ".montahd";

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

function installDirFor(destPath: string): string {
  return destPath.toLowerCase().endsWith(".zip") ? destPath.slice(0, -4) : destPath;
}

async function removeZipDownloadArtifacts(destPath: string): Promise<void> {
  await unlink(destPath + HD_PARTIAL_SUFFIX).catch(() => undefined);
  if (!existsSync(destPath)) return;
  try {
    if (statSync(destPath).isFile()) await unlink(destPath);
  } catch {
    // ignore
  }
}

function remoteTotalBytes(response: Response, startAt: number): number {
  const contentRange = response.headers.get("content-range");
  const match = contentRange?.match(/\/(\d+)\s*$/);
  if (match) {
    const total = Number(match[1]);
    if (Number.isFinite(total) && total > 0) return total;
  }
  const len = Number(response.headers.get("content-length") ?? 0);
  if (!Number.isFinite(len) || len <= 0) return 0;
  if (response.status === 206) return startAt + len;
  return len;
}

class NeedsPcStagingError extends Error {
  readonly sizeBytes: number;
  constructor(sizeBytes: number) {
    super("NEEDS_PC_STAGING");
    this.name = "NeedsPcStagingError";
    this.sizeBytes = sizeBytes;
  }
}

async function probeRemoteSize(url: string, signal?: AbortSignal): Promise<number> {
  try {
    const head = await fetch(url, { method: "HEAD", signal });
    const len = Number(head.headers.get("content-length") ?? 0);
    if (Number.isFinite(len) && len > 0) return len;
  } catch {
    // alguns CDNs não respondem HEAD
  }
  try {
    const range = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      signal,
    });
    await range.body?.cancel().catch(() => undefined);
    const contentRange = range.headers.get("content-range");
    const match = contentRange?.match(/\/(\d+)\s*$/);
    if (match) {
      const total = Number(match[1]);
      if (Number.isFinite(total) && total > 0) return total;
    }
  } catch {
    // segue com o tamanho do catálogo
  }
  return 0;
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
  const prepared = await prepareDownloadEntry(options);
  return installPreparedEntry(prepared, options.onProgress, options.signal);
}

export async function prepareDownloadEntry(options: {
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
}): Promise<PreparedDownload> {
  const catalogSize = options.expectedSize ?? 0;
  const probedSize = await probeRemoteSize(options.url, options.signal);
  const expectedSize = resolveKnownSize(catalogSize, probedSize);
  let target = resolveDownloadTarget(catalogSize, probedSize);
  const report = (progress: DownloadProgress) =>
    options.onProgress({ ...progress, target });
  const resolved = { ...options, expectedSize, onProgress: report };
  try {
    if (target === "pc") {
      return await prepareViaPc(resolved);
    }
    return await prepareOnHd(resolved);
  } catch (error) {
    if (error instanceof NeedsPcStagingError) {
      await unlink(options.destPath + HD_PARTIAL_SUFFIX).catch(() => undefined);
      target = "pc";
      return prepareViaPc({
        ...resolved,
        expectedSize: error.sizeBytes || resolved.expectedSize,
        onProgress: (progress) => options.onProgress({ ...progress, target }),
      });
    }
    throw new Error(formatFsError(error));
  }
}

export async function installPreparedEntry(
  prepared: PreparedDownload,
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<{ installedPath: string }> {
  const report = (progress: DownloadProgress) =>
    onProgress({ ...progress, target: prepared.target });
  if (prepared.target === "pc") {
    return installPreparedViaPc(prepared, report, signal);
  }
  return installPreparedOnHd(prepared, report, signal);
}

async function downloadToFile(
  url: string,
  filePath: string,
  entryId: string,
  label: string,
  expectedSize: number,
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
  refuseOverFat32 = false,
): Promise<number> {
  mkdirSync(path.dirname(filePath), { recursive: true });
  let startAt = existsSync(filePath) ? statSync(filePath).size : 0;

  let response = await fetch(url, {
    headers: startAt > 0 ? { Range: `bytes=${startAt}-` } : {},
    signal,
  });

  if (startAt > 0 && (!response.ok || response.status !== 206)) {
    await unlink(filePath).catch(() => undefined);
    startAt = 0;
    response = await fetch(url, { signal });
  }

  if (!response.ok || !response.body) {
    throw new Error(`Download falhou (${response.status}).`);
  }

  assertDownloadableResponse(response);

  const remoteSize = remoteTotalBytes(response, startAt);
  if (refuseOverFat32 && isOverFat32Limit(remoteSize)) {
    await response.body.cancel().catch(() => undefined);
    await unlink(filePath).catch(() => undefined);
    throw new NeedsPcStagingError(remoteSize);
  }

  await writeStream(response.body, filePath, startAt, entryId, label, expectedSize || remoteSize, onProgress);
  return statSync(filePath).size;
}

async function verifyDownload(
  filePath: string,
  entryId: string,
  label: string,
  fileSize: number,
  expectedSize: number,
  expectedSha256: string | undefined,
  onProgress: (progress: DownloadProgress) => void,
): Promise<void> {
  onProgress({
    entryId,
    label,
    downloadedBytes: fileSize,
    totalBytes: expectedSize || fileSize,
    status: "verifying",
  });

  if (!expectedSha256) return;
  const actual = await hashFile(filePath);
  if (actual !== expectedSha256.toLowerCase()) {
    await unlink(filePath).catch(() => undefined);
    throw new Error("SHA-256 não confere. Arquivo descartado.");
  }
}

async function extractAndPlace(
  zipPath: string,
  destPath: string,
  hdRoot: string,
  extractParent: string,
  entryId: string,
  label: string,
  expectedSize: number,
  fileSize: number,
  onProgress: (progress: DownloadProgress) => void,
  signal: AbortSignal | undefined,
  copyStatus: "installing" | "copying",
): Promise<string> {
  const hdInstallDir = installDirFor(destPath);

  onProgress({
    entryId,
    label,
    downloadedBytes: fileSize,
    totalBytes: expectedSize || fileSize,
    status: "extracting",
  });

  const { contentRoot, tempDir } = await extractZipToContentRoot(
    zipPath,
    hdInstallDir,
    extractParent,
  );

  try {
    await mkdir(hdInstallDir, { recursive: true });
    const installRel = path.relative(hdRoot, hdInstallDir).replace(/\\/g, "/");
    const copyFilter = isGamesDestination(installRel) ? shouldCopyGameFile : undefined;

    const installed = await copyDirectory(
      contentRoot,
      hdInstallDir,
      (copied, total) => {
        onProgress({
          entryId,
          label,
          downloadedBytes: copied,
          totalBytes: total,
          status: copyStatus,
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
              status: copyStatus,
            });
          },
          signal,
        );
      }
    }

    onProgress({
      entryId,
      label,
      downloadedBytes: installed.bytesCopied,
      totalBytes: installed.bytesCopied,
      status: "done",
    });
    return hdInstallDir;
  } finally {
    await removeTempDir(tempDir);
  }
}

/** Zip ≤ 4 GB: baixa no HD FAT32 (extração vem depois, pode ser em paralelo). */
async function prepareOnHd(options: {
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
}): Promise<PreparedDownload> {
  const {
    entryId,
    label,
    url,
    destPath,
    hdRoot,
    stagingRoot,
    expectedSize = 0,
    expectedSha256,
    onProgress,
    signal,
  } = options;

  const zipPartial = destPath + HD_PARTIAL_SUFFIX;
  const fileSize = await downloadToFile(
    url,
    zipPartial,
    entryId,
    label,
    expectedSize,
    onProgress,
    signal,
    true,
  );

  if (isOverFat32Limit(fileSize)) {
    await unlink(zipPartial).catch(() => undefined);
    throw new Error(
      "Este pacote passou de 4 GB e o HD FAT32 do Xbox 360 não aceita o arquivo. " +
        "O catálogo deve marcar o tamanho correto para processar no PC.",
    );
  }

  await verifyDownload(
    zipPartial,
    entryId,
    label,
    fileSize,
    expectedSize,
    expectedSha256,
    onProgress,
  );

  return {
    entryId,
    label,
    destPath,
    hdRoot,
    stagingRoot,
    target: "hd",
    expectedSize,
    fileSize,
    zipPath: zipPartial,
    isZip: await isZipFile(zipPartial),
    stagingDir: null,
    expectedSha256,
  };
}

async function installPreparedOnHd(
  prepared: PreparedDownload,
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<{ installedPath: string }> {
  const {
    entryId,
    label,
    destPath,
    hdRoot,
    expectedSize,
    fileSize,
    zipPath,
    isZip,
  } = prepared;

  if (isZip) {
    const extractParent = path.join(hdRoot, HD_EXTRACT_DIR);
    const installedPath = await extractAndPlace(
      zipPath,
      destPath,
      hdRoot,
      extractParent,
      entryId,
      label,
      expectedSize,
      fileSize,
      onProgress,
      signal,
      "installing",
    );
    await removeZipDownloadArtifacts(destPath);
    return { installedPath };
  }

  await mkdir(path.dirname(destPath), { recursive: true });
  if (existsSync(destPath)) unlinkSync(destPath);
  await copyFile(zipPath, destPath);
  await unlink(zipPath).catch(() => undefined);
  onProgress({
    entryId,
    label,
    downloadedBytes: fileSize,
    totalBytes: expectedSize || fileSize,
    status: "done",
  });
  return { installedPath: destPath };
}

/** Zip > 4 GB: baixa no PC (extração/cópia vem depois). */
async function prepareViaPc(options: {
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
}): Promise<PreparedDownload> {
  const {
    entryId,
    label,
    url,
    destPath,
    hdRoot,
    stagingRoot,
    expectedSize = 0,
    expectedSha256,
    onProgress,
    signal,
  } = options;

  const stagingDir = stagingEntryDir(stagingRoot, entryId);
  mkdirSync(stagingDir, { recursive: true });
  const zipPartial = path.join(stagingDir, STAGING_PARTIAL_NAME);

  const fileSize = await downloadToFile(
    url,
    zipPartial,
    entryId,
    label,
    expectedSize,
    onProgress,
    signal,
  );
  await verifyDownload(
    zipPartial,
    entryId,
    label,
    fileSize,
    expectedSize,
    expectedSha256,
    onProgress,
  );

  return {
    entryId,
    label,
    destPath,
    hdRoot,
    stagingRoot,
    target: "pc",
    expectedSize,
    fileSize,
    zipPath: zipPartial,
    isZip: await isZipFile(zipPartial),
    stagingDir,
    expectedSha256,
  };
}

async function installPreparedViaPc(
  prepared: PreparedDownload,
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<{ installedPath: string }> {
  const {
    entryId,
    label,
    destPath,
    hdRoot,
    expectedSize,
    fileSize,
    zipPath,
    isZip,
    stagingDir,
  } = prepared;

  if (!stagingDir) {
    throw new Error("Instalação via PC sem pasta de staging.");
  }

  let copiedToHd = false;
  try {
    if (isZip) {
      const installedPath = await extractAndPlace(
        zipPath,
        destPath,
        hdRoot,
        stagingDir,
        entryId,
        label,
        expectedSize,
        fileSize,
        onProgress,
        signal,
        "copying",
      );
      copiedToHd = true;
      return { installedPath };
    }

    if (isOverFat32Limit(fileSize)) {
      throw new Error(
        "Este arquivo tem mais de 4 GB e o HD do Xbox 360 (FAT32) não aceita um único arquivo desse tamanho. Use um pacote zip que extraia em vários arquivos menores.",
      );
    }

    await mkdir(path.dirname(destPath), { recursive: true });
    if (existsSync(destPath)) unlinkSync(destPath);
    await copyFile(zipPath, destPath);
    copiedToHd = true;
    onProgress({
      entryId,
      label,
      downloadedBytes: fileSize,
      totalBytes: expectedSize || fileSize,
      status: "done",
    });
    return { installedPath: destPath };
  } finally {
    if (copiedToHd) {
      await removeStagingEntry(stagingDir);
    }
  }
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
