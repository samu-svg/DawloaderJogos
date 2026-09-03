import { timingSafeEqual } from "node:crypto";

/**
 * Regras puras do webhook do Asaas. Sem I/O e sem env, para os testes
 * cobrirem o caminho do dinheiro sem subir nada.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Libera acesso. PIX cai em RECEIVED; CONFIRMED é rede de segurança. */
const GRANT_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

/** Retira acesso: estorno (inclusive agendado), chargeback e remoção. */
const REVOKE_EVENTS = new Set([
  "PAYMENT_REFUNDED",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_REFUND_IN_PROGRESS",
  "PAYMENT_RECEIVED_IN_CASH_UNDONE",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_DELETED",
]);

/**
 * Exigem decisão humana: devolvem acesso que uma revogação tirou. Não é
 * automático porque a janela original pode já ter passado. Na prática só
 * aparecem com cartão — PIX não sofre chargeback.
 */
const REVIEW_EVENTS = new Set([
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
  "PAYMENT_REFUND_DENIED",
  "PAYMENT_RESTORED",
]);

export type AsaasEventAction = "grant" | "revoke" | "review" | "ignore";

export function asaasEventAction(event: string): AsaasEventAction {
  const normalized = event.trim().toUpperCase();
  if (GRANT_EVENTS.has(normalized)) return "grant";
  if (REVOKE_EVENTS.has(normalized)) return "revoke";
  if (REVIEW_EVENTS.has(normalized)) return "review";
  return "ignore";
}

export type AsaasReference = { userId: string; planId: "1m" | "2m" | "3m" };

export function parseAsaasExternalReference(
  reference: string | null | undefined,
): AsaasReference | null {
  if (!reference?.trim()) return null;

  const [userId, planId] = reference.trim().split(":");
  if (!userId || !planId) return null;
  // O userId vai direto para uma coluna uuid: barra lixo antes do banco.
  if (!UUID_PATTERN.test(userId)) return null;
  if (planId !== "1m" && planId !== "2m" && planId !== "3m") return null;

  return { userId, planId };
}

/**
 * O Asaas envia `value` em reais. Comparamos em centavos para não depender de
 * ponto flutuante, com 1 centavo de tolerância para arredondamento.
 */
export function paymentValueMatchesCents(
  value: number | null | undefined,
  expectedCents: number,
): boolean {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  return Math.abs(Math.round(value * 100) - expectedCents) <= 1;
}

/** Comparação de tempo constante: `!==` vaza o tamanho do prefixo correto. */
export function webhookTokenMatches(
  received: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!expected || !received) return false;

  const receivedBuf = Buffer.from(received);
  const expectedBuf = Buffer.from(expected);
  if (receivedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(receivedBuf, expectedBuf);
}
