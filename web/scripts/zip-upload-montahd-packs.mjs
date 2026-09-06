/**
 * Zip each game under C:\.montahd pack folders, upload to R2, delete zip + source.
 * Multi-GOD packs (e.g. 50 Live Arcade) split Content/0000000000000000/{TitleID} individually.
 *
 *   node --env-file=.env.local scripts/zip-upload-montahd-packs.mjs
 */
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
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

const execFileAsync = promisify(execFile);

const GAMES_DIR = "C:\\.montahd";
const ZIP_DIR = "C:\\Users\\doura\\AppData\\Local\\Temp\\montahd-zips";
const STAGING_DIR = "C:\\Users\\doura\\AppData\\Local\\Temp\\montahd-staging";
const R2_PREFIX = "jogos";
const PART_SIZE = 64 * 1024 * 1024;
const CATALOG_PATH = path.join(import.meta.dirname, "montahd-packs-catalog.json");
const TITLE_ID_RE = /^[0-9A-Fa-f]{8}$/;

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

async function listTitleIds(absPath) {
  const zerosDir = path.join(absPath, "Content", "0000000000000000");
  try {
    const entries = await readdir(zerosDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && TITLE_ID_RE.test(entry.name))
      .map((entry) => entry.name.toUpperCase())
      .sort();
  } catch {
    return [];
  }
}

async function hasDefaultXex(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.some(
      (entry) => entry.isFile() && entry.name.toLowerCase() === "default.xex",
    );
  } catch {
    return false;
  }
}

/** XeX game folders (default.xex at root). */
async function discoverXeXGames(rootDir, games, depth = 0, pack = null) {
  if (depth > 8) return;

  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return;
  }

  if (entries.some((e) => e.isFile() && e.name.toLowerCase() === "default.xex")) {
    games.push({
      format: "xex",
      name: path.basename(rootDir),
      absPath: rootDir,
      pack,
      deletePath: rootDir,
    });
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const lower = entry.name.toLowerCase();
    if (lower === "content" || lower === "dlc" || lower === "dlc's") continue;
    await discoverXeXGames(path.join(rootDir, entry.name), games, depth + 1, pack);
  }
}

/** Single-GOD folders: Content/ with one Title ID at root level. */
async function discoverSingleGodGames(rootDir, games, depth = 0, pack = null) {
  if (depth > 8) return;

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
    const titleIds = await listTitleIds(rootDir);
    if (titleIds.length === 1) {
      games.push({
        format: "god",
        name: path.basename(rootDir),
        absPath: rootDir,
        contentTitleId: titleIds[0],
        pack,
        deletePath: rootDir,
      });
      return;
    }
    if (titleIds.length > 1) return;
  }

  if (hasXex) return;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    await discoverSingleGodGames(path.join(rootDir, entry.name), games, depth + 1, pack);
  }
}

/** Multi-GOD container: Content/0000000000000000 with many Title IDs. */
async function discoverMultiGodGames(rootDir, games, pack) {
  const zerosDir = path.join(rootDir, "Content", "0000000000000000");
  let entries;
  try {
    entries = await readdir(zerosDir, { withFileTypes: true });
  } catch {
    return;
  }

  const titleDirs = entries.filter(
    (entry) => entry.isDirectory() && TITLE_ID_RE.test(entry.name),
  );
  if (titleDirs.length < 2) return;

  for (const entry of titleDirs) {
    const titleId = entry.name.toUpperCase();
    games.push({
      format: "god-multi",
      name: titleId,
      absPath: path.join(zerosDir, entry.name),
      contentTitleId: titleId,
      pack,
      deletePath: path.join(zerosDir, entry.name),
      godRoot: rootDir,
    });
  }
}

async function createGodStaging(titleId, titleAbsPath) {
  const stageRoot = path.join(STAGING_DIR, titleId);
  const contentTree = path.join(stageRoot, "Content", "0000000000000000", titleId);
  await rm(stageRoot, { recursive: true, force: true });
  await mkdir(path.dirname(contentTree), { recursive: true });
  await execFileAsync("cmd.exe", ["/c", "mklink", "/J", contentTree, titleAbsPath], {
    windowsHide: true,
  });
  return stageRoot;
}

async function removeStaging(titleId) {
  await rm(path.join(STAGING_DIR, titleId), { recursive: true, force: true });
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

async function removePath(absPath) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(absPath, { recursive: true, force: true });
      return true;
    } catch (error) {
      if (error?.code !== "EBUSY" && error?.code !== "EPERM") throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  console.warn(`  warn — could not delete: ${absPath}`);
  return false;
}

async function removeZip(folderName) {
  await removePath(zipPathFor(folderName));
}

async function findInnerPackDir(packPath) {
  const entries = await readdir(packPath, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length === 1) return path.join(packPath, dirs[0].name);
  return packPath;
}

async function discoverAllGames() {
  await access(GAMES_DIR);
  const games = [];
  const packEntries = await readdir(GAMES_DIR, { withFileTypes: true });

  for (const pack of packEntries) {
    if (!pack.isDirectory()) continue;
    const packPath = path.join(GAMES_DIR, pack.name);
    const innerPath = await findInnerPackDir(packPath);

    await discoverMultiGodGames(innerPath, games, pack.name);

    const xexGames = [];
    await discoverXeXGames(innerPath, xexGames, 0, pack.name);
    games.push(...xexGames);

    const godGames = [];
    await discoverSingleGodGames(innerPath, godGames, 0, pack.name);
    games.push(...godGames);
  }

  const byKey = new Map();
  for (const game of games) {
    const key = `${game.format}:${sanitizeName(game.name)}`;
    if (byKey.has(key)) {
      console.warn(
        `  warn — duplicate "${game.name}" (${game.format}), keeping first:\n    ${byKey.get(key).absPath}\n    ${game.absPath}`,
      );
      continue;
    }
    byKey.set(key, game);
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function zipSourceFor(game) {
  if (game.format !== "god-multi") return { zipSrc: game.absPath, cleanup: async () => {} };
  const stageRoot = await createGodStaging(game.contentTitleId, game.absPath);
  return {
    zipSrc: stageRoot,
    cleanup: async () => removeStaging(game.contentTitleId),
  };
}

async function main() {
  const s3 = client();
  await mkdir(ZIP_DIR, { recursive: true });
  await mkdir(STAGING_DIR, { recursive: true });

  const uniqueGames = await discoverAllGames();
  const catalog = uniqueGames.map((game) => ({
    folderName: game.name,
    absPath: game.absPath,
    pack: game.pack,
    format: game.format,
    contentTitleId: game.contentTitleId ?? null,
    storage_key: r2Key(game.name),
    destination:
      game.contentTitleId
        ? `Content/0000000000000000/${game.contentTitleId}.zip`
        : `Games/${sanitizeName(game.name)}.zip`,
    size_bytes: null,
    status: "pending",
  }));

  const summary = { uploaded: [], skipped: [], failed: [] };
  console.log(`Found ${uniqueGames.length} games in ${GAMES_DIR}`);
  console.log(`  XeX: ${uniqueGames.filter((g) => g.format === "xex").length}`);
  console.log(`  GOD: ${uniqueGames.filter((g) => g.format === "god").length}`);
  console.log(`  GOD-multi: ${uniqueGames.filter((g) => g.format === "god-multi").length}`);

  for (let i = 0; i < uniqueGames.length; i += 1) {
    const game = uniqueGames[i];
    const { name: folderName, deletePath } = game;
    const key = r2Key(folderName);
    const label = `[${i + 1}/${uniqueGames.length}] ${folderName} (${game.format.toUpperCase()})`;
    console.log(`\n${label}`);
    console.log(`  pack:   ${game.pack}`);
    console.log(`  source: ${game.absPath}`);
    if (game.contentTitleId) console.log(`  Title ID: ${game.contentTitleId}`);
    console.log(`  R2 key: ${key}`);

    const catalogEntry = catalog.find(
      (c) => sanitizeName(c.folderName) === sanitizeName(folderName),
    );

    let zipCleanup = async () => {};
    try {
      const existing = await headSize(s3, key);
      if (existing && existing > 0) {
        console.log(`  skip — already on R2 (${existing} bytes)`);
        await removeZip(folderName);
        if (await removePath(deletePath)) {
          console.log("  done — local folder removed (already on R2)");
        }
        if (catalogEntry) {
          catalogEntry.size_bytes = existing;
          catalogEntry.status = "skipped";
        }
        summary.skipped.push({ folder: folderName, key, bytes: existing, format: game.format });
        continue;
      }

      const { zipSrc, cleanup } = await zipSourceFor(game);
      zipCleanup = cleanup;

      console.log("  zipping…");
      await removeZip(folderName);
      await runZip(zipSrc, zipPathFor(folderName));
      await zipCleanup();
      zipCleanup = async () => {};

      const localSize = (await stat(zipPathFor(folderName))).size;
      console.log(`  zip ready (${localSize} bytes)`);

      console.log("  uploading…");
      await uploadMultipart(s3, key, zipPathFor(folderName));

      const remote = await headSize(s3, key);
      if (!remote || remote !== localSize) {
        throw new Error(`R2 size mismatch local=${localSize} remote=${remote}`);
      }

      await removeZip(folderName);
      if (await removePath(deletePath)) {
        console.log("  done — zip and local folder deleted");
      } else {
        console.log("  done — zip deleted (source folder still on disk)");
      }
      if (catalogEntry) {
        catalogEntry.size_bytes = localSize;
        catalogEntry.status = "uploaded";
      }
      summary.uploaded.push({ folder: folderName, key, bytes: localSize, format: game.format });
    } catch (error) {
      await zipCleanup().catch(() => undefined);
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
