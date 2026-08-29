/**
 * Smoke test R2 credentials (run from web/: node --env-file=.env.local scripts/r2-smoke.mjs)
 */
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

const missing = [
  ["R2_ACCOUNT_ID", accountId],
  ["R2_ACCESS_KEY_ID", accessKeyId],
  ["R2_SECRET_ACCESS_KEY", secretAccessKey],
  ["R2_BUCKET", bucket],
].filter(([, value]) => !value);

if (missing.length) {
  console.error("Faltam variáveis:", missing.map(([name]) => name).join(", "));
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log("OK: bucket", bucket, "acessível com as credenciais atuais.");
} catch (error) {
  console.error("Falha ao acessar o R2:", error?.name ?? error);
  process.exit(1);
}
