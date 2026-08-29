import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { isOverFat32Limit } from "../shared/pc-space";

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
  shouldCopy?: (relativePath: string) => boolean,
): Promise<{ filesCopied: number; bytesCopied: number }> {
  const files = await listFiles(sourceDir);
  const filtered = shouldCopy
    ? files.filter((file) => {
        const relative = path.relative(sourceDir, file.absPath).replace(/\\/g, "/");
        return shouldCopy(relative);
      })
    : files;
  const totalBytes = filtered.reduce((sum, file) => sum + file.size, 0);
  let copiedBytes = 0;
  let filesCopied = 0;

  for (const file of filtered) {
    if (signal?.aborted) throw new Error("Operação cancelada.");

    const relative = path.relative(sourceDir, file.absPath);
    const targetPath = path.join(destDir, relative);
    if (isOverFat32Limit(file.size)) {
      throw new Error(
        `O arquivo "${relative.replace(/\\/g, "/")}" tem mais de 4 GB e não cabe no HD FAT32 do Xbox 360.`,
      );
    }
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(file.absPath, targetPath);

    copiedBytes += file.size;
    filesCopied += 1;
    onProgress?.(copiedBytes, totalBytes);
  }

  return { filesCopied, bytesCopied: copiedBytes };
}
