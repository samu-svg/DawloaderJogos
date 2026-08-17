import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

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

/** Copies the contents of sourceDir into destDir, preserving subfolders. */
export async function copyDirectory(
  sourceDir: string,
  destDir: string,
  onProgress?: (copiedBytes: number, totalBytes: number) => void,
  signal?: AbortSignal,
): Promise<{ filesCopied: number; bytesCopied: number }> {
  const files = await listFiles(sourceDir);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  let copiedBytes = 0;
  let filesCopied = 0;

  for (const file of files) {
    if (signal?.aborted) throw new Error("Operação cancelada.");

    const relative = path.relative(sourceDir, file.absPath);
    const targetPath = path.join(destDir, relative);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(file.absPath, targetPath);

    copiedBytes += file.size;
    filesCopied += 1;
    onProgress?.(copiedBytes, totalBytes);
  }

  return { filesCopied, bytesCopied: copiedBytes };
}
