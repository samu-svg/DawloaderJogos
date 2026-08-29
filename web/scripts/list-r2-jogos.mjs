/**
 * List objects under jogos/ in R2.
 *   node --env-file=.env.local scripts/list-r2-jogos.mjs
 */
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const bucket = process.env.R2_BUCKET?.trim();

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("Missing R2 env vars");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

let token;
const keys = [];
do {
  const result = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: "jogos/",
      ContinuationToken: token,
    }),
  );
  for (const obj of result.Contents ?? []) {
    keys.push({ key: obj.Key, bytes: Number(obj.Size ?? 0) });
  }
  token = result.IsTruncated ? result.NextContinuationToken : undefined;
} while (token);

keys.sort((a, b) => a.key.localeCompare(b.key));
for (const row of keys) {
  console.log(`${row.bytes}\t${row.key}`);
}
console.error(`\n${keys.length} objects`);
