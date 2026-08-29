/**
 * Map Title IDs for D:\Games catalog entries from R2 zips (default.xex).
 * Updates dgames-packs-catalog.json with titleId field on each game.
 *
 *   node --env-file=.env.local scripts/map-dgames-titleids.mjs
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

const catalogPath = join(dirname(fileURLToPath(import.meta.url)), "dgames-packs-catalog.json");
const scriptsDir = dirname(catalogPath);

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
const workDir = mkdtempSync(join(tmpdir(), "montahd-tid-"));
let mapped = 0;
let skipped = 0;

try {
  for (const game of catalog) {
    if (game.contentTitleId) {
      game.titleId = game.contentTitleId;
      continue;
    }
    if (game.status !== "uploaded") continue;
    if ((game.size_bytes ?? 0) > 0 && game.size_bytes < 10_000) continue;
    if (game.format !== "xex") continue;

    const key = game.storage_key;
    const zipPath = join(workDir, "game.zip");
    console.log(`Fetching ${key}…`);
    try {
      await downloadKey(key, zipPath);
      const xexPath = extractDefaultXex(zipPath, workDir);
      if (!xexPath) {
        console.warn(`  no default.xex in ${key}`);
        skipped += 1;
        continue;
      }
      const tid = readTitleId(xexPath);
      if (tid) {
        game.titleId = tid;
        mapped += 1;
        console.log(`  ${game.folderName} → ${tid}`);
      } else {
        skipped += 1;
      }
      rmSync(zipPath, { force: true });
      for (const entry of readdirSync(workDir)) {
        rmSync(join(workDir, entry), { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`  FAIL ${key}: ${error instanceof Error ? error.message : error}`);
      skipped += 1;
    }
  }

  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`\nMapped ${mapped}, skipped ${skipped}`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
