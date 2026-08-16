import { createHash } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export interface DownloadProgress {
  entryId: string;
  label: string;
  downloadedBytes: number;
  totalBytes: number;
  status: "downloading" | "verifying" | "importing" | "done" | "error";
  error?: string;
}

const PARTIAL_SUFFIX = ".dawloader.partial";

function partialPath(finalPath: string): string {
  return finalPath + PARTIAL_SUFFIX;
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

export async function downloadEntry(options: {
  entryId: string;
  label: string;
  url: string;
  destPath: string;
  expectedSize?: number;
  expectedSha256?: string;
  onProgress: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const {
    entryId,
    label,
    url,
    destPath,
    expectedSize = 0,
    expectedSha256,
    onProgress,
    signal,
  } = options;

  mkdirSync(path.dirname(destPath), { recursive: true });

  const tempPath = partialPath(destPath);
  let startAt = 0;
  if (existsSync(tempPath)) {
    startAt = statSync(tempPath).size;
  }

  let response = await fetch(url, {
    headers: startAt > 0 ? { Range: `bytes=${startAt}-` } : {},
    signal,
  });

  if (startAt > 0 && (!response.ok || response.status === 416 || response.status === 200)) {
    await unlink(tempPath).catch(() => undefined);
    startAt = 0;
    response = await fetch(url, { signal });
  }

  if (!response.ok || !response.body) {
    throw new Error(`Download falhou (${response.status}).`);
  }

  await writeStream(
    response.body,
    tempPath,
    startAt,
    entryId,
    label,
    expectedSize,
    onProgress,
  );

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

  if (existsSync(destPath)) {
    unlinkSync(destPath);
  }
  await rename(tempPath, destPath);

  onProgress({
    entryId,
    label,
    downloadedBytes: statSync(destPath).size,
    totalBytes: expectedSize || statSync(destPath).size,
    status: "done",
  });
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
