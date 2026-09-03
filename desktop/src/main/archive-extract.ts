import { existsSync } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { detectContentRoot } from "./zip-extract";

const RAR_MAGIC = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]);

export function isRarPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".rar");
}

export async function isRarFile(filePath: string): Promise<boolean> {
  if (isRarPath(filePath)) return true;
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(RAR_MAGIC.length);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead < RAR_MAGIC.length) return false;
    return buffer.equals(RAR_MAGIC);
  } finally {
    await handle.close();
  }
}

function resolve7zExecutable(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bin = require("7zip-bin") as { path7za: string };
    if (bin.path7za && existsSync(bin.path7za)) return bin.path7za;
  } catch {
    // pacote opcional ou indisponível
  }

  const candidates = [
    path.join(process.env.ProgramFiles ?? "", "7-Zip", "7z.exe"),
    path.join(process.env["ProgramFiles(x86)"] ?? "", "7-Zip", "7z.exe"),
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  throw new Error(
    "Não foi possível extrair o .rar. Instale o 7-Zip no Windows ou reinstale o MontaHD.",
  );
}

async function run7zExtract(archivePath: string, destDir: string): Promise<void> {
  const executable = resolve7zExecutable();
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(executable, ["x", archivePath, `-o${destDir}`, "-y"], {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Extração falhou (código ${code ?? "?"}).`));
    });
  });
}

async function createExtractTempDir(extractParent?: string): Promise<string> {
  const base = extractParent?.trim()
    ? path.join(extractParent, "extract-")
    : path.join(os.tmpdir(), "montahd-rar-");
  return mkdtemp(base);
}

/** Extrai .rar para pasta temporária e devolve a raiz do conteúdo. */
export async function extractRarToContentRoot(
  rarPath: string,
  extractParent?: string,
): Promise<{ contentRoot: string; tempDir: string }> {
  const tempDir = await createExtractTempDir(extractParent);
  try {
    await run7zExtract(rarPath, tempDir);
    const contentRoot = await detectContentRoot(tempDir);
    return { contentRoot, tempDir };
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    throw error instanceof Error ? error : new Error(String(error));
  }
}
