/**
 * Preenche sha256 em entries hosted que ainda estão null (backfill passo 9).
 *
 *   node --env-file=.env.local scripts/backfill-hosted-sha256.mjs
 *   node --env-file=.env.local scripts/backfill-hosted-sha256.mjs --limit 3
 *   node --env-file=.env.local scripts/backfill-hosted-sha256.mjs --apply
 */
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : null;

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

async function sha256OfKey(storageKey) {
  const result = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
  );
  const hash = createHash("sha256");
  const body = result.Body;
  if (!body) throw new Error("objeto vazio no R2");

  if (body instanceof Readable) {
    for await (const chunk of body) hash.update(chunk);
  } else if (typeof body.transformToByteArray === "function") {
    hash.update(await body.transformToByteArray());
  } else {
    throw new Error("tipo de stream não suportado");
  }

  return hash.digest("hex");
}

function formatBytes(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`;
  return `${n} B`;
}

function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

let query = supabase
  .from("entries")
  .select("id,label,storage_key,size_bytes")
  .eq("kind", "hosted")
  .is("sha256", null)
  .order("size_bytes", { ascending: true });

if (limit != null && Number.isFinite(limit) && limit > 0) {
  query = query.limit(limit);
}

const { data: entries, error } = await query;

if (error) throw error;

const total = entries?.length ?? 0;
console.log(`\n=== Backfill SHA-256: ${total} entrada(s) sem hash ===`);
console.log(apply ? "Modo: APPLY (grava no Supabase)\n" : "Modo: DRY-RUN (só calcula; use --apply para gravar)\n");

let ok = 0;
let fail = 0;
const failures = [];
const started = Date.now();

for (let i = 0; i < total; i++) {
  const entry = entries[i];
  const prefix = `[${i + 1}/${total}]`;

  if (!entry.storage_key?.startsWith("jogos/")) {
    const msg = `storage_key fora de jogos/: ${entry.storage_key ?? "(null)"}`;
    console.log(`${prefix} SKIP ${entry.label}: ${msg}`);
    failures.push({ label: entry.label, id: entry.id, error: msg });
    fail++;
    continue;
  }

  const sizeLabel = formatBytes(Number(entry.size_bytes ?? 0));
  process.stdout.write(`${prefix} ${entry.label} (${sizeLabel})... `);

  const t0 = Date.now();
  try {
    const sha256 = await sha256OfKey(entry.storage_key);
    const elapsed = formatDuration(Date.now() - t0);
    console.log(`${sha256.slice(0, 12)}... (${elapsed})`);

    if (apply) {
      const { error: updErr } = await supabase
        .from("entries")
        .update({ sha256 })
        .eq("id", entry.id);
      if (updErr) throw updErr;
    }
    ok++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`FALHOU: ${msg}`);
    failures.push({ label: entry.label, id: entry.id, storage_key: entry.storage_key, error: msg });
    fail++;
  }
}

console.log(`\n--- Resumo ---`);
console.log(`OK: ${ok} | Falhas: ${fail} | Tempo total: ${formatDuration(Date.now() - started)}`);

if (failures.length) {
  console.log("\n--- Falhas ---");
  for (const row of failures) console.log(JSON.stringify(row));
}

if (!apply && ok > 0) {
  console.log("\nDry-run concluído. Rode com --apply para gravar no banco.");
}

process.exit(fail ? 1 : 0);
