/**
 * Zip one D:\Games folder at a time, upload to R2, then delete the local zip.
 * Original folders are never deleted. Re-run skips keys already on R2.
 *
 *   node --env-file=.env.local scripts/zip-upload-games.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";

const GAMES_DIR = "D:\\Games";
/** D: is FAT32 (4 GB file cap). Zips must land on NTFS (C:). */
const ZIP_DIR = "C:\\Users\\doura\\AppData\\Local\\Temp\\montahd-zips";
const R2_PREFIX = "jogos";
const PART_SIZE = 64 * 1024 * 1024;

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function sanitizeName(name) {
  return name.replace(/[<>:"|?*\\]/g, "_").replace(/\s+/g, " ").trim();
}

function r2Key(folderName) {
  return `${R2_PREFIX}/${sanitizeName(folderName)}.zip`;
}

function zipPathFor(folderName) {
  return path.join(ZIP_DIR, `${sanitizeName(folderName)}.zip`);
}

function client() {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

function bucket() {
  return requireEnv("R2_BUCKET");
}

async function headSize(s3, key) {
  try {
    const result = await s3.send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key }),
    );
    return Number(result.ContentLength ?? 0);
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") {
      return null;
    }
    throw error;
  }
}

/** ZIP64 on NTFS (C:). Store-only: game files are already compressed. */
function runZip(folderName) {
  const dest = zipPathFor(folderName);
  const src = path.join(GAMES_DIR, folderName);
  const script = path.join(import.meta.dirname, "zip-folder.py");

  return new Promise((resolve, reject) => {
    const child = spawn("python", [script, src, dest], {
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(dest);
      else reject(new Error(`zip exited ${code} for ${folderName}`));
    });
  });
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
      const pct = ((uploaded / fileSize) * 100).toFixed(1);
      console.log(`    upload ${pct}% (${uploaded}/${fileSize}) part ${partNumber}`);
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
      .send(
        new AbortMultipartUploadCommand({
          Bucket: bucket(),
          Key: key,
          UploadId: uploadId,
        }),
      )
      .catch(() => undefined);
    throw error;
  }
}

async function removeZip(folderName) {
  const dest = zipPathFor(folderName);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(dest, { force: true });
      return;
    } catch (error) {
      if (error?.code !== "EBUSY" && error?.code !== "EPERM") throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  console.warn(`  warn — could not delete locked zip, python will overwrite: ${dest}`);
}

async function main() {
  const s3 = client();
  await mkdir(ZIP_DIR, { recursive: true });

  const entries = await readdir(GAMES_DIR, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  const summary = { uploaded: [], skipped: [], failed: [] };
  console.log(`Found ${folders.length} folders in ${GAMES_DIR}`);

  for (let i = 0; i < folders.length; i += 1) {
    const folderName = folders[i];
    const key = r2Key(folderName);
    const label = `[${i + 1}/${folders.length}] ${folderName}`;
    console.log(`\n${label}`);
    console.log(`  R2 key: ${key}`);

    try {
      const existing = await headSize(s3, key);
      if (existing && existing > 0) {
        console.log(`  skip — already on R2 (${existing} bytes)`);
        await removeZip(folderName);
        summary.skipped.push({ folder: folderName, key, bytes: existing });
        continue;
      }

      console.log("  zipping…");
      await removeZip(folderName);
      await runZip(folderName);
      const localSize = (await stat(zipPathFor(folderName))).size;
      console.log(`  zip ready (${localSize} bytes)`);

      console.log("  uploading…");
      await uploadMultipart(s3, key, zipPathFor(folderName));

      const remote = await headSize(s3, key);
      if (!remote || remote !== localSize) {
        throw new Error(`R2 size mismatch local=${localSize} remote=${remote}`);
      }

      await removeZip(folderName);
      console.log("  done — zip deleted locally");
      summary.uploaded.push({ folder: folderName, key, bytes: localSize });
    } catch (error) {
      await removeZip(folderName).catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  FAIL: ${message}`);
      summary.failed.push({ folder: folderName, key, error: message });
    }
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`uploaded: ${summary.uploaded.length}`);
  console.log(`skipped:  ${summary.skipped.length}`);
  console.log(`failed:   ${summary.failed.length}`);
  for (const row of summary.uploaded) console.log(`  OK ${row.key}`);
  for (const row of summary.skipped) console.log(`  SKIP ${row.key}`);
  for (const row of summary.failed) console.log(`  FAIL ${row.folder}: ${row.error}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
