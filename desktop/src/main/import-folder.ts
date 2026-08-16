import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { DownloadProgress } from "./download";
import {
  extractZipToContentRoot,
  isZipPath,
  removeTempDir,
} from "./zip-extract";
import { resolveUnderRoot } from "./paths";

export interface ImportFolderProgress extends DownloadProgress {
  status: "extracting" | "importing" | "done" | "error";
}

async function listFiles(dir: string): Promise<{ absPath: string; size: number }[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: { absPath: string; size: number }[] = [];

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absPath)));
    } else if (entry.isFile()) {
      files.push({ absPath, size: (await stat(absPath)).size });
    }
  }

  return files;
}

/** Copia conteúdo de sourceDir para destDir absoluto (sem validação extra). */
export async function copyDirectoryToAbsolute(
  sourceDir: string,
  destDir: string,
  onFile?: (copiedBytes: number, totalBytes: number) => void,
  signal?: AbortSignal,
): Promise<{ filesCopied: number; bytesCopied: number }> {
  const files = await listFiles(sourceDir);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  let copiedBytes = 0;
  let filesCopied = 0;

  for (const file of files) {
    if (signal?.aborted) {
      throw new Error("Operação cancelada.");
    }

    const relative = path.relative(sourceDir, file.absPath);
    const targetPath = path.join(destDir, relative);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(file.absPath, targetPath);

    copiedBytes += file.size;
    filesCopied += 1;
    onFile?.(copiedBytes, totalBytes);
  }

  return { filesCopied, bytesCopied: copiedBytes };
}

/**
 * Copia uma pasta local para dentro da raiz escolhida pelo usuário,
 * preservando a estrutura de subpastas.
 */
export async function importLocalFolder(options: {
  entryId: string;
  label: string;
  sourceDir: string;
  rootDir: string;
  destination: string;
  onProgress: (progress: ImportFolderProgress) => void;
  signal?: AbortSignal;
}): Promise<{ filesCopied: number; bytesCopied: number }> {
  const { entryId, label, sourceDir, rootDir, destination, onProgress, signal } =
    options;

  const destBase = resolveUnderRoot(rootDir, destination);
  if (!destBase.ok) {
    throw new Error(destBase.error);
  }

  const sourceRoot = path.resolve(sourceDir);
  const sourceStat = await stat(sourceRoot).catch(() => null);
  if (!sourceStat?.isDirectory()) {
    throw new Error("A origem selecionada não é uma pasta.");
  }

  const files = await listFiles(sourceRoot);
  if (files.length === 0) {
    throw new Error("A pasta selecionada está vazia.");
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  let copiedBytes = 0;
  let filesCopied = 0;

  onProgress({
    entryId,
    label,
    downloadedBytes: 0,
    totalBytes,
    status: "importing",
  });

  for (const file of files) {
    if (signal?.aborted) {
      throw new Error("Importação cancelada.");
    }

    const relative = path.relative(sourceRoot, file.absPath);
    const relativePosix = relative.split(path.sep).join("/");
    const target = resolveUnderRoot(rootDir, `${destination}/${relativePosix}`);
    if (!target.ok) {
      throw new Error(`${relativePosix}: ${target.error}`);
    }

    await mkdir(path.dirname(target.fullPath), { recursive: true });
    await copyFile(file.absPath, target.fullPath);

    copiedBytes += file.size;
    filesCopied += 1;

    onProgress({
      entryId,
      label,
      downloadedBytes: copiedBytes,
      totalBytes,
      status: "importing",
    });
  }

  onProgress({
    entryId,
    label,
    downloadedBytes: copiedBytes,
    totalBytes,
    status: "done",
  });

  return { filesCopied, bytesCopied: copiedBytes };
}

/**
 * Importa um .zip (descompacta) ou pasta local para o destino no HD.
 */
export async function importLocalPackage(options: {
  entryId: string;
  label: string;
  sourcePath: string;
  rootDir: string;
  destination: string;
  onProgress: (progress: ImportFolderProgress) => void;
  signal?: AbortSignal;
}): Promise<{ filesCopied: number; bytesCopied: number }> {
  const { entryId, label, sourcePath, rootDir, destination, onProgress, signal } =
    options;

  const resolved = path.resolve(sourcePath);
  const sourceStat = await stat(resolved).catch(() => null);
  if (!sourceStat) {
    throw new Error("Arquivo ou pasta não encontrado.");
  }

  if (sourceStat.isDirectory()) {
    return importLocalFolder({
      entryId,
      label,
      sourceDir: resolved,
      rootDir,
      destination,
      onProgress,
      signal,
    });
  }

  if (!sourceStat.isFile() || !isZipPath(resolved)) {
    throw new Error("Selecione um arquivo .zip ou uma pasta.");
  }

  onProgress({
    entryId,
    label,
    downloadedBytes: 0,
    totalBytes: sourceStat.size,
    status: "extracting",
  });

  const { contentRoot, tempDir } = await extractZipToContentRoot(resolved);

  try {
    return await importLocalFolder({
      entryId,
      label,
      sourceDir: contentRoot,
      rootDir,
      destination,
      onProgress,
      signal,
    });
  } finally {
    await removeTempDir(tempDir);
  }
}
