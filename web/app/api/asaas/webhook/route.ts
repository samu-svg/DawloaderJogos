import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import {
  asaasEventAction,
  asaasPixEnabled,
  asaasWebhookToken,
  asaasWebhookTokenMatches,
  getAsaasPayment,
  parseAsaasExternalReference,
  paymentValueMatchesPlan,
  type AsaasWebhookEvent,
} from "@/lib/asaas";
import { asaasPaymentIsPaid } from "@/lib/asaas-pix-format";
import { logError, logWarn } from "@/lib/logger";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getPlan } from "@/lib/stripe-plans";
import {
  asaasCustomerRef,
  grantPrepaidAccess,
  revokePrepaidAccess,
} from "@/lib/prepaid-access";

export const runtime = "nodejs";

/**
 * Credita o acesso relendo o pagamento na API do Asaas.
 *
 * O payload do webhook não é fonte da verdade para dinheiro: quem tiver o
 * token poderia inventar valor e status. O `externalReference` vem do
 * pagamento real, criado por nós no checkout.
 */
async function handleGrant(paymentId: string, eventId: string): Promise<void> {
  const payment = await getAsaasPayment(paymentId);

  const parsed = parseAsaasExternalReference(payment.externalReference);
  if (!parsed) {
    logWarn("Asaas: pagamento sem referência de usuário", { paymentId, eventId });
    return;
  }

  if (!asaasPaymentIsPaid(payment.status)) {
    logWarn("Asaas: evento de crédito com pagamento não pago", {
      paymentId,
      eventId,
      status: payment.status,
    });
    return;
  }

  const plan = getPlan(parsed.planId);
  if (!paymentValueMatchesPlan(payment.value, parsed.planId)) {
    logError("Asaas: valor pago diverge do plano", undefined, {
      paymentId,
      eventId,
      planId: parsed.planId,
      paidValue: payment.value,
      expectedCents: plan.priceCents,
    });
    await recordAudit({
      actorId: parsed.userId,
      action: "asaas.payment.value_mismatch",
      entity: "subscription",
      entityId: paymentId,
      metadata: { plan: parsed.planId, paidValue: payment.value },
    });
    return;
  }

  const result = await grantPrepaidAccess({
    userId: parsed.userId,
    provider: "asaas",
    paymentId: payment.id,
    planId: parsed.planId,
    amountCents: plan.priceCents,
    customerRef: asaasCustomerRef(payment.customer),
  });

  // Reenvio do mesmo evento: o razão já tinha o crédito.
  if (!result.created) return;

  await recordAudit({
    actorId: parsed.userId,
    action: "asaas.payment.received",
    entity: "subscription",
    entityId: payment.id,
    metadata: {
      status: "active",
      kind: "prepaid",
      months: plan.months,
      plan: parsed.planId,
      periodEnd: result.periodEnd,
    },
  });
}

async function handleRevoke(paymentId: string, eventType: string): Promise<void> {
  const result = await revokePrepaidAccess({
    provider: "asaas",
    paymentId,
    reason: eventType,
  });

  if (!result.revoked) return;

  logWarn("Asaas: acesso pré-pago revogado", {
    paymentId,
    eventType,
    periodEnd: result.periodEnd,
  });
  await recordAudit({
    action: "asaas.payment.revoked",
    entity: "subscription",
    entityId: paymentId,
    metadata: { event: eventType, periodEnd: result.periodEnd },
  });
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "asaas-webhook", RATE_LIMITS.medium);
  if (limited) return limited;

  if (!asaasPixEnabled()) {
    return NextResponse.json({ error: "PIX desativado." }, { status: 503 });
  }

  if (!asaasWebhookToken()) {
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  if (!asaasWebhookTokenMatches(request.headers.get("asaas-access-token"))) {
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  let event: AsaasWebhookEvent;
  try {
    event = (await request.json()) as AsaasWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (!event?.id || !event?.event) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }

  const action = asaasEventAction(event.event);
  const paymentId = event.payment?.id?.trim();

  try {
    if (action === "grant" || action === "revoke") {
      if (!paymentId) {
        return NextResponse.json({ error: "Pagamento ausente." }, { status: 400 });
      }
      if (action === "grant") {
        await handleGrant(paymentId, event.id);
      } else {
        await handleRevoke(paymentId, event.event);
      }
    } else if (action === "review") {
      // Devolver acesso depende da janela original e não pode ser automático.
      logWarn("Asaas: evento exige revisão manual", {
        eventId: event.id,
        eventType: event.event,
        paymentId,
      });
      await recordAudit({
        action: "asaas.payment.needs_review",
        entity: "subscription",
        entityId: paymentId,
        metadata: { event: event.event },
      });
    }
  } catch (error) {
    // 5xx faz o Asaas reenviar. Em fila sequencial isso pausa a fila, que é o
    // comportamento desejado: nenhum evento de dinheiro é perdido em silêncio.
    logError("Asaas webhook handler failed", error, {
      eventId: event.id,
      type: event.event,
      paymentId,
    });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
