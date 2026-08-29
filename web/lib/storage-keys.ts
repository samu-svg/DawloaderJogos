import { randomUUID } from "node:crypto";

/** Safe object key under a portfolio prefix in the R2 bucket. */
export function buildStorageKey(portfolioId: string, fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim() || "file.bin";
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  return `${portfolioId}/${randomUUID()}/${safe || "file.bin"}`;
}

export function storageKeyBelongsToPortfolio(
  storageKey: string,
  portfolioId: string,
): boolean {
  if (!storageKey || storageKey.includes("..")) return false;
  const prefix = `${portfolioId}/`;
  return storageKey.startsWith(prefix) && storageKey.length > prefix.length;
}

/** Prefixo obrigatório para importação manual (rclone/Cyberduck). */
export const IMPORT_STORAGE_PREFIX = "jogos/";

/** Object key uploaded manually — only under `jogos/` in the bucket. */
export function isValidImportStorageKey(storageKey: string): boolean {
  const key = storageKey.trim().replace(/^\/+/, "");
  if (!key || key.length > 1024 || key.includes("..")) return false;
  if (key.startsWith("/") || /[\u0000-\u001f]/.test(key)) return false;
  if (!key.startsWith(IMPORT_STORAGE_PREFIX)) return false;
  if (key.length <= IMPORT_STORAGE_PREFIX.length) return false;
  return /^[\w./ -]+$/.test(key);
}

export function normalizeImportStorageKey(raw: string): string {
  return raw.trim().replace(/^\/+/, "").replace(/\\/g, "/");
}

export function hostedStorageKeyAllowed(
  storageKey: string,
  portfolioId: string,
): boolean {
  return (
    storageKeyBelongsToPortfolio(storageKey, portfolioId) ||
    isValidImportStorageKey(storageKey)
  );
}
