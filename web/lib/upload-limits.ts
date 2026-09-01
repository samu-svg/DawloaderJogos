/** Hard cap for a single R2 multipart upload started by the painel. */
export const MAX_UPLOAD_BYTES = 128 * 1024 * 1024 * 1024;

const ALLOWED_UPLOAD_CONTENT_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
]);

export function fileNameLooksLikeZip(fileName: string | undefined): boolean {
  return /\.zip$/i.test(fileName?.trim() ?? "");
}

export function resolveUploadContentType(
  raw: string | undefined,
  fileName?: string,
): string {
  const value =
    (raw?.trim() || "").toLowerCase().split(";")[0]?.trim() ?? "";
  if (value && value !== "application/octet-stream") return value;
  if (fileNameLooksLikeZip(fileName)) return "application/zip";
  return value || "application/octet-stream";
}

export function isAllowedUploadContentType(
  contentType: string,
  fileName?: string,
): boolean {
  const resolved = resolveUploadContentType(contentType, fileName);
  if (resolved === "application/octet-stream") return fileNameLooksLikeZip(fileName);
  return ALLOWED_UPLOAD_CONTENT_TYPES.has(resolved);
}

export function isAllowedUploadSize(sizeBytes: number): boolean {
  return Number.isFinite(sizeBytes) && sizeBytes > 0 && sizeBytes <= MAX_UPLOAD_BYTES;
}

/** Rejects an object that grew past what the client declared at start. */
export function uploadedSizeMatchesDeclaration(
  declaredBytes: number,
  actualBytes: number,
): boolean {
  if (!isAllowedUploadSize(declaredBytes) || !isAllowedUploadSize(actualBytes)) {
    return false;
  }
  return actualBytes <= declaredBytes;
}
