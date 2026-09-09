import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  desktopInstallerR2Key,
  isKnownInstallerFileName,
} from "@/lib/desktop-download";
import { isR2Configured } from "@/lib/r2-configured";
import { headObjectSize, signDownloadUrl } from "@/lib/storage";

export { desktopInstallerR2Key, isKnownInstallerFileName };

const UPDATE_MANIFESTS = new Set([
  "latest.yml",
  "latest-ia32.yml",
  "legacy/latest.yml",
  "legacy/latest-ia32.yml",
]);

function manifestPath(relativePath: string): string {
  return path.join(process.cwd(), "content", "desktop-updates", relativePath);
}

export async function readUpdateManifest(
  relativePath: string,
): Promise<string | null> {
  if (!UPDATE_MANIFESTS.has(relativePath)) return null;
  try {
    return await readFile(manifestPath(relativePath), "utf8");
  } catch {
    return null;
  }
}

/** URL assinada do R2 para o instalador (bytes não passam pela Vercel). */
export async function resolveInstallerSignedUrl(
  fileName: string,
): Promise<string | null> {
  if (!isKnownInstallerFileName(fileName) || !isR2Configured()) return null;

  const storageKey = desktopInstallerR2Key(fileName);
  try {
    await headObjectSize(storageKey);
    return signDownloadUrl(storageKey, fileName);
  } catch {
    return null;
  }
}
