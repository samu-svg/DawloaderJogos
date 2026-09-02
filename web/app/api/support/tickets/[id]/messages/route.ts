import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { canManageSupport } from "@/lib/rbac";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { validateSupportBody } from "@/lib/support";
import { createClient } from "@/lib/supabase/server";
import { isTrustedAuthOrigin } from "@/lib/trusted-origin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
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
    "support-reply",
    RATE_LIMITS.support,
    user.id,
  );
  if (limited) return limited;

  const slow = await enforceRateLimit(
    request,
    "support-reply",
    RATE_LIMITS.supportSlow,
    user.id,
  );
  if (slow) return slow;

  let body: { body?: string };
  try {
    body = (await request.json()) as { body?: string };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const message = validateSupportBody(body.body ?? "");
  if (!message.ok) {
    return NextResponse.json({ error: message.error }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (ticketError) {
    logError("support reply ticket lookup failed", ticketError);
    return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
  }
  if (!ticket) {
    return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
  }

  const isOwner = ticket.user_id === user.id;
  const isAdmin = canManageSupport(user.role);
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
  }
  if (ticket.status === "closed") {
    return NextResponse.json(
      { error: "Este ticket está fechado." },
      { status: 409 },
    );
  }

  const { error: messageError } = await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    author_id: user.id,
    body: message.value,
  });

  if (messageError) {
    logError("support reply insert failed", messageError);
    return NextResponse.json(
      { error: "Não foi possível enviar a mensagem." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
