/**
 * Audit jogos360 entries against R2 keys and install destination rules.
 *   node --env-file=.env.local scripts/audit-catalog-r2.mjs
 */
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const PORTFOLIO_ID = "e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda";

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
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
);

async function listR2Keys() {
  const keys = new Map();
  let token;
  do {
    const result = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: "jogos/", ContinuationToken: token }),
    );
    for (const obj of result.Contents ?? []) {
      keys.set(obj.Key, Number(obj.Size ?? 0));
    }
    token = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

function expectedDestination(entry) {
  if (entry.kind !== "hosted" || !entry.storage_key) return null;
  const key = entry.storage_key;
  if (key.startsWith("jogos/content/")) {
    const titleId = key.replace("jogos/content/", "").replace(".zip", "");
    return `Content/0000000000000000/${titleId}.zip`;
  }
  if (entry.destination?.startsWith("Content/0000000000000000/")) {
    return entry.destination;
  }
  const fileName = key.slice("jogos/".length);
  return `Games/${fileName}`;
}

const r2 = await listR2Keys();
const { data: entries, error } = await supabase
  .from("entries")
  .select("id,label,destination,storage_key,kind,group_name")
  .eq("portfolio_id", PORTFOLIO_ID)
  .order("sort_order");

if (error) throw error;

const missingR2 = [];
const badDestination = [];

for (const entry of entries ?? []) {
  if (entry.kind === "external") continue;
  if (!entry.storage_key) {
    missingR2.push({ label: entry.label, issue: "no storage_key" });
    continue;
  }
  if (!r2.has(entry.storage_key)) {
    missingR2.push({ label: entry.label, storage_key: entry.storage_key, issue: "not on R2" });
    continue;
  }
  const expected = expectedDestination(entry);
  if (expected && entry.destination !== expected) {
    badDestination.push({
      label: entry.label,
      current: entry.destination,
      expected,
      storage_key: entry.storage_key,
    });
  }
}

console.log(`\n=== AUDIT jogos360 (${entries?.length ?? 0} entries, ${r2.size} R2 keys) ===`);
console.log(`Missing R2: ${missingR2.length}`);
console.log(`Bad destination: ${badDestination.length}`);

if (missingR2.length) {
  console.log("\n--- Missing R2 ---");
  for (const row of missingR2) console.log(JSON.stringify(row));
}
if (badDestination.length) {
  console.log("\n--- Bad destination ---");
  for (const row of badDestination) console.log(JSON.stringify(row));
}

process.exit(missingR2.length || badDestination.length ? 1 : 0);
