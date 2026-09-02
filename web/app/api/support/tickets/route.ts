import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  SUPPORT_MAX_OPEN_TICKETS,
  validateSupportBody,
  validateSupportSubject,
} from "@/lib/support";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isTrustedAuthOrigin } from "@/lib/trusted-origin";

export async function POST(request: Request) {
  if (!isTrustedAuthOrigin(request)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  }

  const limited = await enforceRateLimit(
    request,
    "support-create",
    RATE_LIMITS.support,
    user.id,
  );
  if (limited) return limited;

  const slow = await enforceRateLimit(
    request,
    "support-create",
    RATE_LIMITS.supportSlow,
    user.id,
  );
  if (slow) return slow;

  let body: { subject?: string; body?: string };
  try {
    body = (await request.json()) as { subject?: string; body?: string };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const subject = validateSupportSubject(body.subject ?? "");
  if (!subject.ok) {
    return NextResponse.json({ error: subject.error }, { status: 400 });
  }
  const message = validateSupportBody(body.body ?? "");
  if (!message.ok) {
    return NextResponse.json({ error: message.error }, { status: 400 });
  }

  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["open", "answered"]);

  if (countError) {
    logError("support ticket count failed", countError);
    return NextResponse.json(
      { error: "Não foi possível abrir o ticket." },
      { status: 500 },
    );
  }
  if ((count ?? 0) >= SUPPORT_MAX_OPEN_TICKETS) {
    return NextResponse.json(
      {
        error: `Você já tem ${SUPPORT_MAX_OPEN_TICKETS} tickets abertos. Aguarde resposta ou feche um deles.`,
      },
      { status: 429 },
    );
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      user_email: user.email,
      subject: subject.value,
      status: "open",
    })
    .select("id")
    .single();

  if (ticketError || !ticket) {
    logError("support ticket insert failed", ticketError);
    return NextResponse.json(
      { error: "Não foi possível abrir o ticket." },
      { status: 500 },
    );
  }

  const { error: messageError } = await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    author_id: user.id,
    body: message.value,
  });

  if (messageError) {
    logError("support first message insert failed", messageError);
    try {
      const admin = createServiceRoleClient();
      await admin.from("support_tickets").delete().eq("id", ticket.id);
    } catch (cleanupError) {
      logError("support orphan ticket cleanup failed", cleanupError);
    }
    return NextResponse.json(
      { error: "Não foi possível enviar a mensagem." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: ticket.id });
}
