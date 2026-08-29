import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

const keys = process.argv.slice(2);
if (!keys.length) {
  console.error("usage: node --env-file=.env.local scripts/head-r2-keys.mjs <key>...");
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const accountId = requireEnv("R2_ACCOUNT_ID");
const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
const bucket = requireEnv("R2_BUCKET");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

for (const key of keys) {
  try {
    const result = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    console.log(`${result.ContentLength}\t${key}`);
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode ?? error?.name ?? "err";
    console.log(`MISSING(${status})\t${key}`);
  }
}
