/**
 * Zip GOD-format Telegram pack games (Content/ without default.xex), upload to R2,
 * then delete local zip and source folder after confirmed upload.
 *
 *   node --env-file=.env.local scripts/zip-upload-telegram-god.mjs
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
const R2_PREFIX = "jogos";
const PART_SIZE = 64 * 1024 * 1024;

const games = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "telegram-god-games-catalog.json"), "utf8"),
);

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

async function removeFolder(absPath) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(absPath, { recursive: true, force: true });
      return true;
    } catch (error) {
      if (error?.code !== "EBUSY" && error?.code !== "EPERM") throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  console.warn(`  warn — could not delete folder: ${absPath}`);
  return false;
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
  console.warn(`  warn — could not delete zip: ${dest}`);
}

async function main() {
  const s3 = client();
  await mkdir(ZIP_DIR, { recursive: true });

  const summary = { uploaded: [], skipped: [], failed: [] };
  console.log(`GOD games to process: ${games.length}`);

  for (let i = 0; i < games.length; i += 1) {
    const game = games[i];
    const { folderName, absPath } = game;
    const key = r2Key(folderName);
    const label = `[${i + 1}/${games.length}] ${game.label}`;
    console.log(`\n${label}`);
    console.log(`  source: ${absPath}`);
    console.log(`  Title ID: ${game.contentTitleId}`);
    console.log(`  R2 key: ${key}`);

    try {
      const existing = await headSize(s3, key);
      if (existing && existing > 0) {
        console.log(`  skip — already on R2 (${existing} bytes)`);
        await removeZip(folderName);
        if (await removeFolder(absPath)) {
          console.log("  done — local folder removed (already on R2)");
        }
        summary.skipped.push({ folder: folderName, key, bytes: existing });
        game.size_bytes = existing;
        continue;
      }

      await access(absPath);

      console.log("  zipping…");
      await removeZip(folderName);
      await runZip(absPath, zipPathFor(folderName));
      const localSize = (await stat(zipPathFor(folderName))).size;
      console.log(`  zip ready (${localSize} bytes)`);
      game.size_bytes = localSize;

      console.log("  uploading…");
      await uploadMultipart(s3, key, zipPathFor(folderName));

      const remote = await headSize(s3, key);
      if (!remote || remote !== localSize) {
        throw new Error(`R2 size mismatch local=${localSize} remote=${remote}`);
      }

      await removeZip(folderName);
      if (await removeFolder(absPath)) {
        console.log("  done — zip and local folder deleted");
      } else {
        console.log("  done — zip deleted (folder still on disk)");
      }
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

  if (summary.failed.length > 0) process.exit(1);

  const catalogPath = path.join(import.meta.dirname, "telegram-god-games-catalog.json");
  writeFileSync(catalogPath, `${JSON.stringify(games, null, 2)}\n`);
  console.log(`Updated sizes in ${catalogPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
