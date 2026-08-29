/** Hard cap for a single R2 multipart upload started by the painel. */
export const MAX_UPLOAD_BYTES = 128 * 1024 * 1024 * 1024;

const ALLOWED_UPLOAD_CONTENT_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);

export function resolveUploadContentType(raw: string | undefined): string {
  const value =
    (raw?.trim() || "application/octet-stream").toLowerCase().split(";")[0]?.trim() ??
    "";
  return value || "application/octet-stream";
}

export function isAllowedUploadContentType(contentType: string): boolean {
  return ALLOWED_UPLOAD_CONTENT_TYPES.has(resolveUploadContentType(contentType));
}

export function isAllowedUploadSize(sizeBytes: number): boolean {
  return Number.isFinite(sizeBytes) && sizeBytes > 0 && sizeBytes <= MAX_UPLOAD_BYTES;
}
