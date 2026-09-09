/**
 * Envia instaladores MontaHD para o R2 (prefixo installers/).
 * Uso (na pasta web):
 *   node --env-file=.env.local scripts/upload-installers-r2.mjs [pasta-com-exe]
 *
 * Se omitir a pasta, usa ../desktop/release631 e ../desktop-legacy/release631-legacy.
 */
import { createReadStream } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const repoRoot = path.join(webRoot, "..");

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

const SETUP_PATTERN =
  /^MontaHD-\d+\.\d+\.\d+(?:-ia32|-legacy-ia32|-legacy-x64)?-setup\.exe$/;

function r2KeyForFileName(fileName) {
  if (fileName.includes("-legacy-")) {
    return `installers/legacy/${fileName}`;
  }
  return `installers/${fileName}`;
}

async function exists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") {
      return false;
    }
    throw error;
  }
}

async function uploadFile(localPath, key) {
  const fileSize = (await stat(localPath)).size;
  console.log(`Upload ${path.basename(localPath)} -> ${key} (${fileSize} bytes)`);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(localPath),
      ContentType: "application/octet-stream",
    }),
  );
}

async function collectFromDir(dir) {
  const files = [];
  try {
    await access(dir);
  } catch {
    return files;
  }
  for (const name of await readdir(dir)) {
    if (!SETUP_PATTERN.test(name)) continue;
    files.push(path.join(dir, name));
  }
  return files;
}

async function main() {
  const inputDir = process.argv[2]?.trim();
  let localFiles = [];

  if (inputDir) {
    localFiles = await collectFromDir(path.resolve(inputDir));
  } else {
    const desktopRelease = path.join(repoRoot, "desktop", "release631");
    const legacyRelease = path.join(repoRoot, "desktop-legacy", "release631-legacy");
    localFiles = [
      ...(await collectFromDir(desktopRelease)),
      ...(await collectFromDir(legacyRelease)),
    ];
  }

  if (localFiles.length === 0) {
    console.error("Nenhum setup.exe encontrado. Passe a pasta do build como argumento.");
    process.exit(1);
  }

  for (const localPath of localFiles) {
    const fileName = path.basename(localPath);
    const key = r2KeyForFileName(fileName);
    if (await exists(key)) {
      console.log(`SKIP (ja existe): ${key}`);
      continue;
    }
    await uploadFile(localPath, key);
    console.log(`OK: ${key}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
