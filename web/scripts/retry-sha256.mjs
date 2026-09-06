/** Retry SHA-256 for specific storage keys. */
import { createHash } from "node:crypto";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const KEYS = ["jogos/58410B1D.zip", "jogos/Zumba Kids.zip"];

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
const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
);

async function hashKey(key) {
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const hash = createHash("sha256");
  for await (const chunk of result.Body) hash.update(chunk);
  return hash.digest("hex");
}

for (const key of KEYS) {
  console.log(`Hashing ${key}…`);
  const sha256 = await hashKey(key);
  const { error } = await supabase.from("entries").update({ sha256 }).eq("storage_key", key);
  console.log(`${key} ${sha256.slice(0, 12)}… ${error?.message ?? "OK"}`);
}
