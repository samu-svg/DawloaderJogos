import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import {
  asaasPixEnabled,
  asaasWebhookToken,
  parseAsaasExternalReference,
  type AsaasWebhookEvent,
} from "@/lib/asaas";
import { logError } from "@/lib/logger";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getPlan } from "@/lib/stripe-plans";
import { upsertPrepaidAccessFromAsaasPayment } from "@/lib/asaas-subscription-sync";

export const runtime = "nodejs";

async function grantPixAccess(payment: NonNullable<AsaasWebhookEvent["payment"]>) {
  const parsed = parseAsaasExternalReference(payment.externalReference);
  if (!parsed) return;

  const months = getPlan(parsed.planId).months;
  const granted = await upsertPrepaidAccessFromAsaasPayment(
    parsed.userId,
    payment.customer,
    months,
    payment.id,
  );
  if (!granted) return;

  await recordAudit({
    actorId: parsed.userId,
    action: "asaas.payment.received",
    entity: "subscription",
    entityId: payment.id,
    metadata: { status: "active", kind: "prepaid", months, plan: parsed.planId },
  });
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "asaas-webhook", RATE_LIMITS.medium);
  if (limited) return limited;

  if (!asaasPixEnabled()) {
    return NextResponse.json({ error: "PIX desativado." }, { status: 503 });
  }

  const expectedToken = asaasWebhookToken();
  if (!expectedToken) {
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  const receivedToken = request.headers.get("asaas-access-token");
  if (receivedToken !== expectedToken) {
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  let event: AsaasWebhookEvent;
  try {
    event = (await request.json()) as AsaasWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (!event.id || !event.event) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }

  try {
    if (event.event === "PAYMENT_RECEIVED" && event.payment) {
      await grantPixAccess(event.payment);
    }
  } catch (error) {
    logError("Asaas webhook handler failed", error, { eventId: event.id, type: event.event });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
