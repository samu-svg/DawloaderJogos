"use server";

import { requireAppUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function ackPasswordRotation(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAppUser({ skipPasswordCheck: true });
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("profiles")
    .update({ password_changed_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Não foi possível atualizar o registro da senha." };

  await recordAudit({
    actorId: user.id,
    action: "password.rotated",
    entity: "user",
    entityId: user.id,
  });
  return { ok: true };
}
