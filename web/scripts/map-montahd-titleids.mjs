/**
 * Map Title IDs for MontaHD XeX games from R2 zips (default.xex).
 *
 *   node --env-file=.env.local scripts/map-montahd-titleids.mjs
 */
import { spawnSync } from "node:child_process";
import {
  createWriteStream,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { pipeline } from "node:stream/promises";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const catalogPath = join(scriptsDir, "montahd-packs-catalog.json");
const metadataPath = join(scriptsDir, "montahd-metadata.json");

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
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

function extractDefaultXex(zipPath, outDir) {
  const result = spawnSync(
    "python",
    [
      "-c",
      "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); n=[x for x in z.namelist() if x.lower().endswith('default.xex')][0]; z.extract(n, sys.argv[2]); print(n)",
      zipPath,
      outDir,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return null;
  const name = result.stdout.trim();
  return join(outDir, name);
}

function readTitleId(xexPath) {
  const result = spawnSync("python", ["scripts/read-xex-titleid.py", xexPath], {
    encoding: "utf8",
    cwd: join(scriptsDir, ".."),
  });
  if (result.status !== 0) return null;
  return result.stdout.trim().toUpperCase();
}

async function downloadKey(key, dest) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  await pipeline(response.Body, createWriteStream(dest));
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const workDir = mkdtempSync(join(tmpdir(), "montahd-tid-"));

try {
  for (const game of catalog) {
    if (game.format !== "xex" || game.status !== "uploaded") continue;
    const key = game.storage_key;
    const zipPath = join(workDir, "game.zip");
    console.log(`Fetching ${key}…`);
    try {
      await downloadKey(key, zipPath);
      const xexPath = extractDefaultXex(zipPath, workDir);
      if (!xexPath) {
        console.warn(`  no default.xex in ${key}`);
        continue;
      }
      const tid = readTitleId(xexPath);
      if (tid) {
        metadata[game.folderName] = {
          ...(metadata[game.folderName] ?? {}),
          titleId: tid,
        };
        console.log(`  ${game.folderName} → ${tid}`);
      }
      rmSync(zipPath, { force: true });
      for (const entry of readdirSync(workDir)) {
        rmSync(join(workDir, entry), { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`  FAIL ${key}: ${error instanceof Error ? error.message : error}`);
    }
  }

  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log("\nUpdated montahd-metadata.json");
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
