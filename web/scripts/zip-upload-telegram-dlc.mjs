/**
 * Zip Telegram pack DLC Title ID folders and upload to R2 as jogos/content/{TitleID}.zip
 *
 *   node --env-file=.env.local scripts/zip-upload-telegram-dlc.mjs
 */
import { spawn } from "node:child_process";
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { access, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";

const ZIP_DIR = "C:\\Users\\doura\\AppData\\Local\\Temp\\montahd-zips";
const PART_SIZE = 64 * 1024 * 1024;

const dlcs = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "telegram-dlc-catalog.json"), "utf8"),
);

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

function bucket() {
  return requireEnv("R2_BUCKET");
}

function r2Key(titleId) {
  return `jogos/content/${titleId}.zip`;
}

function zipPathFor(titleId) {
  return path.join(ZIP_DIR, `${titleId}.zip`);
}

function runZip(srcPath, destPath) {
  const script = path.join(import.meta.dirname, "zip-folder.py");
  return new Promise((resolve, reject) => {
    const child = spawn("python", [script, srcPath, destPath], {
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(destPath);
      else reject(new Error(`zip exited ${code} for ${srcPath}`));
    });
  });
}

async function headSize(s3, key) {
  try {
    const result = await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return Number(result.ContentLength ?? 0);
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") return null;
    throw error;
  }
}

async function uploadMultipart(s3, key, filePath) {
  const fileSize = (await stat(filePath)).size;
  const created = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: "application/zip",
    }),
  );
  const uploadId = created.UploadId;
  if (!uploadId) throw new Error("R2 did not return UploadId");

  const parts = [];
  let partNumber = 1;
  let uploaded = 0;

  try {
    const stream = createReadStream(filePath, { highWaterMark: PART_SIZE });
    let buffer = Buffer.alloc(0);

    async function sendPart(body) {
      const result = await s3.send(
        new UploadPartCommand({
          Bucket: bucket(),
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: body,
        }),
      );
      if (!result.ETag) throw new Error(`Part ${partNumber} missing ETag`);
      parts.push({ ETag: result.ETag, PartNumber: partNumber });
      uploaded += body.length;
      console.log(`    upload ${((uploaded / fileSize) * 100).toFixed(1)}% part ${partNumber}`);
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
        Bucket: bucket(),
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
        },
      }),
    );
    return fileSize;
  } catch (error) {
    await s3
      .send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }))
      .catch(() => undefined);
    throw error;
  }
}

async function main() {
  const s3 = client();
  await mkdir(ZIP_DIR, { recursive: true });
  const summary = { uploaded: [], skipped: [], failed: [] };

  for (let i = 0; i < dlcs.length; i += 1) {
    const dlc = dlcs[i];
    const key = r2Key(dlc.contentTitleId);
    console.log(`\n[${i + 1}/${dlcs.length}] ${dlc.label} (${dlc.contentTitleId})`);

    try {
      await access(dlc.absPath);
      const existing = await headSize(s3, key);
      if (existing && existing > 0) {
        console.log(`  skip — already on R2 (${existing} bytes)`);
        dlc.size_bytes = existing;
        summary.skipped.push(dlc.contentTitleId);
        continue;
      }

      console.log("  zipping…");
      await rm(zipPathFor(dlc.contentTitleId), { force: true });
      await runZip(dlc.absPath, zipPathFor(dlc.contentTitleId));
      const localSize = (await stat(zipPathFor(dlc.contentTitleId))).size;
      dlc.size_bytes = localSize;
      console.log(`  zip ready (${localSize} bytes)`);

      console.log("  uploading…");
      await uploadMultipart(s3, key, zipPathFor(dlc.contentTitleId));
      await rm(zipPathFor(dlc.contentTitleId), { force: true });
      summary.uploaded.push(dlc.contentTitleId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  FAIL: ${message}`);
      summary.failed.push({ id: dlc.contentTitleId, error: message });
    }
  }

  writeFileSync(
    path.join(import.meta.dirname, "telegram-dlc-catalog.json"),
    `${JSON.stringify(dlcs, null, 2)}\n`,
  );

  console.log("\n========== SUMMARY ==========");
  console.log(`uploaded: ${summary.uploaded.length}`);
  console.log(`skipped:  ${summary.skipped.length}`);
  console.log(`failed:   ${summary.failed.length}`);
  if (summary.failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
