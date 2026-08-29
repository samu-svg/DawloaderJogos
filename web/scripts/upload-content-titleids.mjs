/**
 * Zip Xbox 360 TitleID folders and upload to jogos/content/{TitleID}.zip
 * Does not touch D:\Games originals. Uses a separate temp dir from the 61-folder lote.
 *
 *   node --env-file=.env.local scripts/upload-content-titleids.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
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

const ZIP_DIR = "C:\\Users\\doura\\AppData\\Local\\Temp\\montahd-content-zips";
const PART_SIZE = 64 * 1024 * 1024;

const PACKS = [
  {
    titleId: "584109D2",
    src: "D:\\Games\\Teenage Mutant Ninja  Turtles In Time Re-Shelled\\Content\\0000000000000000\\584109D2",
  },
  {
    titleId: "4B4E0801",
    src: "D:\\Games\\Pro Evolution Soccer 2010 + DLC\\DLC\\Content\\0000000000000000\\4B4E0801",
  },
];

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
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

function r2Key(titleId) {
  return `jogos/content/${titleId}.zip`;
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

function runZip(src, dest) {
  const script = path.join(import.meta.dirname, "zip-folder.py");
  return new Promise((resolve, reject) => {
    const child = spawn("python", [script, src, dest], {
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(dest);
      else reject(new Error(`zip exited ${code}`));
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

async function main() {
  const s3 = client();
  await mkdir(ZIP_DIR, { recursive: true });

  for (const pack of PACKS) {
    const key = r2Key(pack.titleId);
    const dest = path.join(ZIP_DIR, `${pack.titleId}.zip`);
    console.log(`\n${pack.titleId}`);
    console.log(`  src: ${pack.src}`);
    console.log(`  R2 key: ${key}`);

    const existing = await headSize(s3, key);
    if (existing && existing > 0) {
      console.log(`  skip — already on R2 (${existing} bytes)`);
      await rm(dest, { force: true });
      continue;
    }

    console.log("  zipping…");
    await rm(dest, { force: true });
    await runZip(pack.src, dest);
    const localSize = (await stat(dest)).size;
    console.log(`  zip ready (${localSize} bytes)`);
    console.log("  uploading…");
    await uploadMultipart(s3, key, dest);
    const remote = await headSize(s3, key);
    if (!remote || remote !== localSize) {
      throw new Error(`R2 size mismatch local=${localSize} remote=${remote}`);
    }
    await rm(dest, { force: true });
    console.log("  done");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
