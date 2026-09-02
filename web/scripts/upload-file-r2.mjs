/**
 * Upload a local file to R2 under jogos/ (multipart).
 *   node --env-file=.env.local scripts/upload-file-r2.mjs "<path>" [r2-key-without-prefix]
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";

const filePath = process.argv[2]?.trim();
const keyArg = process.argv[3]?.trim();
const PART_SIZE = 64 * 1024 * 1024;

if (!filePath) {
  console.error(
    'usage: node --env-file=.env.local scripts/upload-file-r2.mjs "<path>" [object-name]',
  );
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function sanitizeKeyName(name) {
  return name.replace(/[<>:"|?*\\]/g, "_").replace(/\s+/g, " ").trim();
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  },
});
const bucket = requireEnv("R2_BUCKET");

const baseName = sanitizeKeyName(path.basename(filePath));
const key = `jogos/${keyArg ? sanitizeKeyName(keyArg) : baseName}`;

async function headSize(storageKey) {
  try {
    const result = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: storageKey }),
    );
    return Number(result.ContentLength ?? 0);
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") {
      return null;
    }
    throw error;
  }
}

async function uploadMultipart(storageKey, localPath) {
  const fileSize = (await stat(localPath)).size;
  const created = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: "application/octet-stream",
    }),
  );
  const uploadId = created.UploadId;
  if (!uploadId) throw new Error("R2 did not return UploadId");

  const parts = [];
  let partNumber = 1;
  let uploaded = 0;

  try {
    const stream = createReadStream(localPath, { highWaterMark: PART_SIZE });
    let buffer = Buffer.alloc(0);

    async function sendPart(body) {
      const result = await s3.send(
        new UploadPartCommand({
          Bucket: bucket,
          Key: storageKey,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: body,
        }),
      );
      if (!result.ETag) throw new Error(`Part ${partNumber} missing ETag`);
      parts.push({ ETag: result.ETag, PartNumber: partNumber });
      uploaded += body.length;
      const pct = ((uploaded / fileSize) * 100).toFixed(1);
      console.log(`  upload ${pct}% part ${partNumber}`);
      partNumber += 1;
    }

    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= PART_SIZE) {
        const piece = buffer.subarray(0, PART_SIZE);
        buffer = buffer.subarray(PART_SIZE);
        await sendPart(piece);
      }
    }
    if (buffer.length > 0) await sendPart(buffer);

    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: storageKey,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
        },
      }),
    );
    return fileSize;
  } catch (error) {
    await s3
      .send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: storageKey,
          UploadId: uploadId,
        }),
      )
      .catch(() => undefined);
    throw error;
  }
}

const existing = await headSize(key);
if (existing && existing > 0) {
  console.log(`SKIP: ${key} already exists (${existing} bytes)`);
  process.exit(0);
}

const fileSize = (await stat(filePath)).size;
console.log(`Uploading ${filePath}`);
console.log(`  -> ${key} (${fileSize} bytes)`);
await uploadMultipart(key, filePath);
console.log(`OK: ${key}`);
