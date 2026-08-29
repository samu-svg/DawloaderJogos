"use server";

import { requireAppUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export async function ackPasswordRotation(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAppUser({ skipPasswordCheck: true });
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: {
      display_name: user.displayName,
      password_changed_at: new Date().toISOString(),
    },
  });
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    actorId: user.id,
    action: "password.rotated",
    entity: "user",
    entityId: user.id,
  });
  return { ok: true };
}
