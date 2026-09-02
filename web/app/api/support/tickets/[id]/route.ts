import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { canManageSupport } from "@/lib/rbac";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { parseSupportStatus } from "@/lib/support";
import { createClient } from "@/lib/supabase/server";
import { isTrustedAuthOrigin } from "@/lib/trusted-origin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isTrustedAuthOrigin(request)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Ticket inválido." }, { status: 400 });
  }

  const limited = await enforceRateLimit(
    request,
    "support-status",
    RATE_LIMITS.support,
    user.id,
  );
  if (limited) return limited;

  let body: { status?: string };
  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const status = parseSupportStatus(body.status);
  if (!status) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const isAdmin = canManageSupport(user.role);
  if (!isAdmin && status !== "closed") {
    return NextResponse.json(
      { error: "Você só pode fechar o ticket." },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (ticketError || !ticket) {
    return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
  }

  const isOwner = ticket.user_id === user.id;
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
  }

  if (ticket.status === status) {
    return NextResponse.json({ ok: true });
  }

  const { error: updateError } = await supabase
    .from("support_tickets")
    .update({ status })
    .eq("id", id);

  if (updateError) {
    logError("support status update failed", updateError);
    return NextResponse.json(
      { error: "Não foi possível atualizar o ticket." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
