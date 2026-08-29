import { decryptSensitive, encryptSensitive } from "@/lib/crypto";
import { planMaxHds } from "@/lib/plan-limits";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function storeFingerprint(value: string): string {
  if (!process.env.ENCRYPTION_KEY?.trim()) return value;
  return encryptSensitive(value);
}

const FINGERPRINT_RE = /^[a-f0-9]{64}$/i;

export function isValidHdFingerprint(value: string): boolean {
  return FINGERPRINT_RE.test(value.trim());
}

export type UserHdRow = {
  fingerprint: string;
  label: string | null;
  registered_at: string;
  last_used_at: string;
};

export async function listUserHds(userId: string): Promise<UserHdRow[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("user_hds")
    .select("fingerprint, label, registered_at, last_used_at")
    .eq("user_id", userId)
    .order("registered_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    fingerprint: decryptSensitive(row.fingerprint),
    label: row.label,
    registered_at: row.registered_at,
    last_used_at: row.last_used_at,
  }));
}

export type HdAccessResult =
  | { ok: true }
  | { ok: false; error: string; status: 403 };

export async function assertHdAccess(
  userId: string,
  fingerprint: string,
): Promise<HdAccessResult> {
  const normalized = fingerprint.trim().toLowerCase();
  if (!isValidHdFingerprint(normalized)) {
    return {
      ok: false,
      status: 403,
      error: "Identificador de HD inválido.",
    };
  }

  const maxHds = planMaxHds();
  const supabase = createServiceRoleClient();
  const { data: existing, error } = await supabase
    .from("user_hds")
    .select("id, fingerprint")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const rows = existing ?? [];
  const known = rows.some((row) => {
    try {
      return decryptSensitive(row.fingerprint) === normalized;
    } catch {
      return row.fingerprint === normalized;
    }
  });

  if (known) {
    await touchUserHd(userId, normalized);
    return { ok: true };
  }

  if (rows.length >= maxHds) {
    const label = maxHds === 1 ? "1 HD" : `${maxHds} HDs`;
    return {
      ok: false,
      status: 403,
      error: `Seu plano permite ${label}. Este HD não está registrado na sua conta.`,
    };
  }

  const { error: insertError } = await supabase.from("user_hds").insert({
    user_id: userId,
    fingerprint: storeFingerprint(normalized),
  });
  if (insertError) throw new Error(insertError.message);

  return { ok: true };
}

async function touchUserHd(userId: string, fingerprint: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: rows } = await supabase
    .from("user_hds")
    .select("id, fingerprint")
    .eq("user_id", userId);

  const match = (rows ?? []).find((row) => {
    try {
      return decryptSensitive(row.fingerprint) === fingerprint;
    } catch {
      return row.fingerprint === fingerprint;
    }
  });
  if (!match) return;

  await supabase
    .from("user_hds")
    .update({
      last_used_at: new Date().toISOString(),
      fingerprint: storeFingerprint(fingerprint),
    })
    .eq("id", match.id);
}

export async function userOwnsHdFingerprint(
  userId: string,
  fingerprint: string,
): Promise<boolean> {
  const normalized = fingerprint.trim().toLowerCase();
  if (!isValidHdFingerprint(normalized)) return false;

  const listed = await listUserHds(userId);
  return listed.some((item) => item.fingerprint === normalized);
}
