import { mkdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: unknown }).code === code
  );
}

/** `D:\` no Windows ou `/` no Unix — `mkdir` na raiz lança EPERM. */
export function isFilesystemRoot(dir: string): boolean {
  const resolved = path.resolve(dir);
  return path.parse(resolved).root === resolved;
}

async function ensureDirWalk(dir: string): Promise<void> {
  const resolved = path.resolve(dir);
  const { root } = path.parse(resolved);
  if (resolved === root) return;

  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    await mkdir(resolved, { recursive: true });
    return;
  }

  let current = root;
  for (const segment of relative.split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    try {
      await mkdir(current);
    } catch (error) {
      if (isNodeErrorCode(error, "EEXIST")) continue;
      throw error;
    }
  }
}

function ensureDirWalkSync(dir: string): void {
  const resolved = path.resolve(dir);
  const { root } = path.parse(resolved);
  if (resolved === root) return;

  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    mkdirSync(resolved, { recursive: true });
    return;
  }

  let current = root;
  for (const segment of relative.split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    try {
      mkdirSync(current);
    } catch (error) {
      if (isNodeErrorCode(error, "EEXIST")) continue;
      throw error;
    }
  }
}

/** Cria a pasta sem tentar `mkdir` da raiz do disco (EPERM no Windows). */
export async function ensureDir(dir: string): Promise<void> {
  const resolved = path.resolve(dir);
  if (isFilesystemRoot(resolved)) return;
  try {
    await mkdir(resolved, { recursive: true });
  } catch (error) {
    if (isNodeErrorCode(error, "EPERM") || isNodeErrorCode(error, "EACCES")) {
      await ensureDirWalk(resolved);
      return;
    }
    throw error;
  }
}

export function ensureDirSync(dir: string): void {
  const resolved = path.resolve(dir);
  if (isFilesystemRoot(resolved)) return;
  try {
    mkdirSync(resolved, { recursive: true });
  } catch (error) {
    if (isNodeErrorCode(error, "EPERM") || isNodeErrorCode(error, "EACCES")) {
      ensureDirWalkSync(resolved);
      return;
    }
    throw error;
  }
}
