import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** R2 rejects parts under 5 MiB except for the last one. */
export const MIN_PART_SIZE = 5 * 1024 * 1024;
/** Chosen so a 100 GB file still fits inside the 10.000 part ceiling. */
export const PART_SIZE = 64 * 1024 * 1024;

const UPLOAD_URL_TTL = 3600;

let cachedClient: S3Client | null = null;

function client(): S3Client {
  if (cachedClient) return cachedClient;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Credenciais do R2 ausentes. Preencha R2_ACCOUNT_ID, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY.",
    );
  }

  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

function bucket(): string {
  const name = process.env.R2_BUCKET;
  if (!name) throw new Error("R2_BUCKET não está definida.");
  return name;
}

export function downloadUrlTtl(): number {
  const parsed = Number(process.env.R2_SIGNED_URL_TTL);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 21600;
}

/**
 * Temporary direct link to the object. The file never passes through the app
 * server, and Range requests work, so an interrupted download resumes instead
 * of restarting.
 */
export function signDownloadUrl(
  storageKey: string,
  downloadName: string,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: storageKey,
    ResponseContentDisposition: `attachment; filename="${downloadName.replace(/"/g, "")}"`,
  });
  return getSignedUrl(client(), command, { expiresIn: downloadUrlTtl() });
}

export async function startUpload(
  storageKey: string,
  contentType = "application/octet-stream",
): Promise<string> {
  const result = await client().send(
    new CreateMultipartUploadCommand({
      Bucket: bucket(),
      Key: storageKey,
      ContentType: contentType,
    }),
  );
  if (!result.UploadId) {
    throw new Error("O R2 não retornou um identificador de upload.");
  }
  return result.UploadId;
}

export function signUploadPart(
  storageKey: string,
  uploadId: string,
  partNumber: number,
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: bucket(),
    Key: storageKey,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(client(), command, { expiresIn: UPLOAD_URL_TTL });
}

export async function completeUpload(
  storageKey: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
): Promise<void> {
  await client().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: storageKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .slice()
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
      },
    }),
  );
}

export async function abortUpload(
  storageKey: string,
  uploadId: string,
): Promise<void> {
  await client().send(
    new AbortMultipartUploadCommand({
      Bucket: bucket(),
      Key: storageKey,
      UploadId: uploadId,
    }),
  );
}

export async function deleteObject(storageKey: string): Promise<void> {
  await client().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: storageKey }),
  );
}

/** Confirms an object exists in the bucket and returns its size (for R2 import). */
export async function headObjectSize(storageKey: string): Promise<number> {
  const result = await client().send(
    new HeadObjectCommand({ Bucket: bucket(), Key: storageKey }),
  );
  const size = Number(result.ContentLength ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("Objeto R2 sem tamanho válido.");
  }
  return size;
}
