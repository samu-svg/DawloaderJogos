/**
 * Zip each Xbox 360 game folder under D:\Games pack folders (XeX + GOD),
 * upload to R2, then delete local zip AND source game folder.
 * Re-run skips keys already on R2 and still removes the local folder.
 *
 *   node --env-file=.env.local scripts/zip-upload-games-packs.mjs
 */
import { spawn } from "node:child_process";
import { access, mkdir, readdir, rm, stat } from "node:fs/promises";
import { createReadStream, writeFileSync } from "node:fs";
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
const ZIP_DIR = "C:\\Users\\doura\\AppData\\Local\\Temp\\montahd-zips";
const R2_PREFIX = "jogos";
const PART_SIZE = 64 * 1024 * 1024;
const CATALOG_PATH = path.join(import.meta.dirname, "dgames-packs-catalog.json");

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

async function readGodTitleId(absPath) {
  const zerosDir = path.join(absPath, "Content", "0000000000000000");
  try {
    const entries = await readdir(zerosDir, { withFileTypes: true });
    const titleDir = entries.find((entry) => entry.isDirectory());
    return titleDir?.name ?? null;
  } catch {
    return null;
  }
}

/** Directories whose root contains default.xex are XeX game folders. */
async function discoverXeXGames(rootDir, games, depth = 0) {
  if (depth > 6) return;

  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return;
  }

  const hasXex = entries.some(
    (entry) => entry.isFile() && entry.name.toLowerCase() === "default.xex",
  );
  if (hasXex) {
    games.push({
      format: "xex",
      name: path.basename(rootDir),
      absPath: rootDir,
      pack: null,
    });
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    await discoverXeXGames(path.join(rootDir, entry.name), games, depth + 1);
  }
}

/** GOD: Content/0000000000000000/{TitleID} without default.xex at root. */
async function discoverGodGames(rootDir, games, depth = 0) {
  if (depth > 6) return;

  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return;
  }

  const hasXex = entries.some(
    (entry) => entry.isFile() && entry.name.toLowerCase() === "default.xex",
  );
  const hasContent = entries.some(
    (entry) => entry.isDirectory() && entry.name.toLowerCase() === "content",
  );

  if (hasContent && !hasXex) {
    const titleId = await readGodTitleId(rootDir);
    if (titleId) {
      games.push({
        format: "god",
        name: path.basename(rootDir),
        absPath: rootDir,
        contentTitleId: titleId,
        pack: null,
      });
      return;
    }
  }

  if (hasXex) return;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    await discoverGodGames(path.join(rootDir, entry.name), games, depth + 1);
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

async function removeGameFolder(absPath) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(absPath, { recursive: true, force: true });
      return true;
    } catch (error) {
      if (error?.code !== "EBUSY" && error?.code !== "EPERM") throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  console.warn(`  warn — could not delete game folder: ${absPath}`);
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
  console.warn(`  warn — could not delete locked zip: ${dest}`);
}

async function discoverAllGames() {
  await access(GAMES_DIR);
  const games = [];

  const packEntries = await readdir(GAMES_DIR, { withFileTypes: true });
  for (const pack of packEntries) {
    if (!pack.isDirectory()) continue;
    const packPath = path.join(GAMES_DIR, pack.name);

    const xexGames = [];
    await discoverXeXGames(packPath, xexGames);
    for (const game of xexGames) game.pack = pack.name;

    const godGames = [];
    await discoverGodGames(packPath, godGames);
    for (const game of godGames) game.pack = pack.name;

    games.push(...xexGames, ...godGames);
  }

  const byName = new Map();
  for (const game of games) {
    const key = sanitizeName(game.name);
    if (byName.has(key)) {
      console.warn(
        `  warn — duplicate name "${game.name}", keeping first:\n    ${byName.get(key).absPath}\n    ${game.absPath}`,
      );
      continue;
    }
    byName.set(key, game);
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function main() {
  const s3 = client();
  await mkdir(ZIP_DIR, { recursive: true });

  const uniqueGames = await discoverAllGames();
  const catalog = uniqueGames.map((game) => ({
    folderName: game.name,
    absPath: game.absPath,
    pack: game.pack,
    format: game.format,
    contentTitleId: game.contentTitleId ?? null,
    storage_key: r2Key(game.name),
    destination:
      game.format === "god" && game.contentTitleId
        ? `Content/0000000000000000/${game.contentTitleId}.zip`
        : `Games/${sanitizeName(game.name)}.zip`,
    size_bytes: null,
    status: "pending",
  }));

  const summary = { uploaded: [], skipped: [], failed: [] };
  console.log(`Found ${uniqueGames.length} game folders in ${GAMES_DIR}`);
  console.log(`  XeX: ${uniqueGames.filter((g) => g.format === "xex").length}`);
  console.log(`  GOD: ${uniqueGames.filter((g) => g.format === "god").length}`);

  for (let i = 0; i < uniqueGames.length; i += 1) {
    const game = uniqueGames[i];
    const { name: folderName, absPath } = game;
    const key = r2Key(folderName);
    const label = `[${i + 1}/${uniqueGames.length}] ${folderName} (${game.format.toUpperCase()})`;
    console.log(`\n${label}`);
    console.log(`  pack:   ${game.pack}`);
    console.log(`  source: ${absPath}`);
    if (game.contentTitleId) console.log(`  Title ID: ${game.contentTitleId}`);
    console.log(`  R2 key: ${key}`);

    const catalogEntry = catalog.find((c) => sanitizeName(c.folderName) === sanitizeName(folderName));

    try {
      const existing = await headSize(s3, key);
      if (existing && existing > 0) {
        console.log(`  skip — already on R2 (${existing} bytes)`);
        await removeZip(folderName);
        if (await removeGameFolder(absPath)) {
          console.log("  done — local folder removed (already on R2)");
        }
        if (catalogEntry) {
          catalogEntry.size_bytes = existing;
          catalogEntry.status = "skipped";
        }
        summary.skipped.push({ folder: folderName, key, bytes: existing, format: game.format });
        continue;
      }

      console.log("  zipping…");
      await removeZip(folderName);
      await runZip(absPath, zipPathFor(folderName));
      const localSize = (await stat(zipPathFor(folderName))).size;
      console.log(`  zip ready (${localSize} bytes)`);

      console.log("  uploading…");
      await uploadMultipart(s3, key, zipPathFor(folderName));

      const remote = await headSize(s3, key);
      if (!remote || remote !== localSize) {
        throw new Error(`R2 size mismatch local=${localSize} remote=${remote}`);
      }

      await removeZip(folderName);
      if (await removeGameFolder(absPath)) {
        console.log("  done — zip and local folder deleted");
      } else {
        console.log("  done — zip deleted locally (folder still on disk)");
      }
      if (catalogEntry) {
        catalogEntry.size_bytes = localSize;
        catalogEntry.status = "uploaded";
      }
      summary.uploaded.push({ folder: folderName, key, bytes: localSize, format: game.format });
    } catch (error) {
      await removeZip(folderName).catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  FAIL: ${message}`);
      if (catalogEntry) catalogEntry.status = "failed";
      summary.failed.push({ folder: folderName, key, error: message, format: game.format });
    }
  }

  writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);

  console.log("\n========== SUMMARY ==========");
  console.log(`uploaded: ${summary.uploaded.length}`);
  console.log(`skipped:  ${summary.skipped.length}`);
  console.log(`failed:   ${summary.failed.length}`);
  for (const row of summary.uploaded) console.log(`  OK ${row.key} (${row.format})`);
  for (const row of summary.skipped) console.log(`  SKIP ${row.key} (${row.format})`);
  for (const row of summary.failed) console.log(`  FAIL ${row.folder}: ${row.error}`);

  console.log(`\nCatalog written to ${CATALOG_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
