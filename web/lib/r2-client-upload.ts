import { Sha256 } from "@/lib/sha256-stream";

export type R2UploadResult = {
  storageKey: string;
  sizeBytes: number;
  sha256: string;
};

type UploadPart = { partNumber: number; etag: string };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Falha na requisição (${response.status}).`);
  }
  return payload;
}

async function abortUpload(
  portfolioSlug: string,
  storageKey: string,
  uploadId: string,
): Promise<void> {
  await postJson("/api/upload/abort", { portfolioSlug, storageKey, uploadId }).catch(() => undefined);
}

/**
 * Uploads a file straight to R2 with presigned multipart URLs. Bytes never pass
 * through the Next.js server — only short-lived signatures do.
 */
export async function uploadFileToR2(options: {
  file: File;
  portfolioSlug: string;
  partSize: number;
  onProgress?: (loadedBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
}): Promise<R2UploadResult> {
  const { file, portfolioSlug, partSize, onProgress, signal } = options;

  const start = await postJson<{
    storageKey: string;
    uploadId: string;
    partSize: number;
  }>("/api/upload/start", {
    portfolioSlug,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  });

  const chunkSize = start.partSize || partSize;
  const totalParts = Math.max(1, Math.ceil(file.size / chunkSize));
  const parts: UploadPart[] = [];
  const hasher = new Sha256();
  let loaded = 0;

  try {
    for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
      if (signal?.aborted) {
        throw new Error("Upload cancelado.");
      }

      const startByte = (partNumber - 1) * chunkSize;
      const endByte = Math.min(startByte + chunkSize, file.size);
      const bytes = new Uint8Array(
        await file.slice(startByte, endByte).arrayBuffer(),
      );
      hasher.update(bytes);

      const { url } = await postJson<{ url: string }>("/api/upload/sign-part", {
        portfolioSlug,
        storageKey: start.storageKey,
        uploadId: start.uploadId,
        partNumber,
      });

      const response = await fetch(url, {
        method: "PUT",
        body: bytes,
        signal,
      });

      if (!response.ok) {
        throw new Error(`Falha ao enviar parte ${partNumber} (${response.status}).`);
      }

      const etag = response.headers.get("etag")?.replace(/"/g, "");
      if (!etag) {
        throw new Error(`A parte ${partNumber} não retornou ETag.`);
      }

      parts.push({ partNumber, etag });
      loaded = endByte;
      onProgress?.(loaded, file.size);
    }

    await postJson("/api/upload/complete", {
      portfolioSlug,
      storageKey: start.storageKey,
      uploadId: start.uploadId,
      sizeBytes: file.size,
      parts,
    });

    return {
      storageKey: start.storageKey,
      sizeBytes: file.size,
      sha256: hasher.digestHex(),
    };
  } catch (error) {
    await abortUpload(portfolioSlug, start.storageKey, start.uploadId);
    throw error;
  }
}

export const DEFAULT_R2_PART_SIZE = 64 * 1024 * 1024;
