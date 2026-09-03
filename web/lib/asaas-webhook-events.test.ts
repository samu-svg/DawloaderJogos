import test from "node:test";
import assert from "node:assert/strict";
import {
  asaasEventAction,
  parseAsaasExternalReference,
  paymentValueMatchesCents,
  webhookTokenMatches,
} from "./asaas-webhook-events.ts";

const USER = "b2c3d4e5-0001-4000-8000-000000000079";

test("eventos que liberam acesso", () => {
  assert.equal(asaasEventAction("PAYMENT_RECEIVED"), "grant");
  assert.equal(asaasEventAction("PAYMENT_CONFIRMED"), "grant");
  assert.equal(asaasEventAction("  payment_received  "), "grant");
});

test("eventos que retiram acesso", () => {
  assert.equal(asaasEventAction("PAYMENT_REFUNDED"), "revoke");
  assert.equal(asaasEventAction("PAYMENT_PARTIALLY_REFUNDED"), "revoke");
  assert.equal(asaasEventAction("PAYMENT_REFUND_IN_PROGRESS"), "revoke");
  assert.equal(asaasEventAction("PAYMENT_RECEIVED_IN_CASH_UNDONE"), "revoke");
  assert.equal(asaasEventAction("PAYMENT_CHARGEBACK_REQUESTED"), "revoke");
  assert.equal(asaasEventAction("PAYMENT_DELETED"), "revoke");
});

test("eventos de revisão manual não creditam nem revogam", () => {
  assert.equal(asaasEventAction("PAYMENT_CHARGEBACK_DISPUTE"), "review");
  assert.equal(asaasEventAction("PAYMENT_AWAITING_CHARGEBACK_REVERSAL"), "review");
  assert.equal(asaasEventAction("PAYMENT_REFUND_DENIED"), "review");
  assert.equal(asaasEventAction("PAYMENT_RESTORED"), "review");
});

test("eventos irrelevantes são ignorados", () => {
  assert.equal(asaasEventAction("PAYMENT_CREATED"), "ignore");
  assert.equal(asaasEventAction("PAYMENT_OVERDUE"), "ignore");
  assert.equal(asaasEventAction("PAYMENT_CHECKOUT_VIEWED"), "ignore");
  assert.equal(asaasEventAction("TRANSFER_DONE"), "ignore");
  assert.equal(asaasEventAction(""), "ignore");
});

test("referência externa aceita uuid + plano conhecido", () => {
  assert.deepEqual(parseAsaasExternalReference(`${USER}:2m`), {
    userId: USER,
    planId: "2m",
  });
  assert.deepEqual(parseAsaasExternalReference(` ${USER}:1m `), {
    userId: USER,
    planId: "1m",
  });
});

test("referência externa rejeita userId que não é uuid", () => {
  assert.equal(parseAsaasExternalReference("nao-e-uuid:1m"), null);
  assert.equal(parseAsaasExternalReference("'; drop table users --:1m"), null);
  assert.equal(parseAsaasExternalReference(":1m"), null);
});

test("referência externa rejeita plano desconhecido ou vazia", () => {
  assert.equal(parseAsaasExternalReference(`${USER}:12m`), null);
  assert.equal(parseAsaasExternalReference(`${USER}:`), null);
  assert.equal(parseAsaasExternalReference(USER), null);
  assert.equal(parseAsaasExternalReference(null), null);
  assert.equal(parseAsaasExternalReference("   "), null);
});

test("valor pago confere em centavos, com 1 centavo de tolerância", () => {
  assert.equal(paymentValueMatchesCents(49.9, 4990), true);
  assert.equal(paymentValueMatchesCents(49.91, 4990), true);
  assert.equal(paymentValueMatchesCents(49.89, 4990), true);
  assert.equal(paymentValueMatchesCents(159.9, 15990), true);
});

test("valor pago divergente não confere", () => {
  assert.equal(paymentValueMatchesCents(1, 4990), false);
  assert.equal(paymentValueMatchesCents(49.5, 4990), false);
  assert.equal(paymentValueMatchesCents(0, 4990), false);
  assert.equal(paymentValueMatchesCents(-49.9, 4990), false);
  // Um rótulo malformado gerava cobrança 10x; o teto agora é o inteiro.
  assert.equal(paymentValueMatchesCents(1599, 15990), false);
});

test("valor ausente ou não numérico nunca confere", () => {
  assert.equal(paymentValueMatchesCents(undefined, 4990), false);
  assert.equal(paymentValueMatchesCents(null, 4990), false);
  assert.equal(paymentValueMatchesCents(Number.NaN, 4990), false);
  assert.equal(paymentValueMatchesCents(Number.POSITIVE_INFINITY, 4990), false);
});

test("token do webhook exige igualdade exata", () => {
  assert.equal(webhookTokenMatches("segredo-do-webhook", "segredo-do-webhook"), true);
  assert.equal(webhookTokenMatches("segredo-do-webhookX", "segredo-do-webhook"), false);
  assert.equal(webhookTokenMatches("segredo-do-webhoo", "segredo-do-webhook"), false);
  assert.equal(webhookTokenMatches("outro", "segredo-do-webhook"), false);
});

test("token ausente nos dois lados nunca passa", () => {
  assert.equal(webhookTokenMatches(null, "segredo"), false);
  assert.equal(webhookTokenMatches("", "segredo"), false);
  assert.equal(webhookTokenMatches("segredo", null), false);
  assert.equal(webhookTokenMatches("segredo", ""), false);
  assert.equal(webhookTokenMatches(null, null), false);
});
