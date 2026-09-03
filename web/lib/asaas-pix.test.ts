import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asaasPaymentIsExpired,
  asaasPaymentIsPaid,
  formatCountdown,
  isAsaasPaymentId,
  parseAsaasDateTime,
  pixCheckoutPath,
  pixPlanPath,
  pixQrImageSrc,
} from "./asaas-pix-format.ts";

test("id de pagamento Asaas", () => {
  assert.equal(isAsaasPaymentId("pay_080225813252"), true);
  assert.equal(isAsaasPaymentId("pay_abcXYZ123"), true);
  assert.equal(isAsaasPaymentId("pay_"), false);
  assert.equal(isAsaasPaymentId("cus_123"), false);
  assert.equal(isAsaasPaymentId("../pay_1"), false);
});

test("status pago e expirado", () => {
  assert.equal(asaasPaymentIsPaid("RECEIVED"), true);
  assert.equal(asaasPaymentIsPaid("confirmed"), true);
  assert.equal(asaasPaymentIsPaid("PENDING"), false);
  assert.equal(asaasPaymentIsExpired("OVERDUE"), true);
  assert.equal(asaasPaymentIsExpired("PENDING"), false);
});

test("caminho do checkout PIX", () => {
  assert.equal(pixCheckoutPath("pay_abc"), "/assinar/pix?payment=pay_abc");
  assert.equal(pixPlanPath("1m"), "/assinar/pix?plan=1m");
  assert.equal(pixPlanPath("3m"), "/assinar/pix?plan=3m");
});

test("imagem do QR Code", () => {
  assert.equal(pixQrImageSrc("abc+def"), "data:image/png;base64,abc+def");
  assert.equal(
    pixQrImageSrc("data:image/png;base64,abc"),
    "data:image/png;base64,abc",
  );
});

test("data do Asaas é interpretada em São Paulo", () => {
  assert.equal(
    parseAsaasDateTime("2026-09-03 18:00:00")?.toISOString(),
    "2026-09-03T21:00:00.000Z",
  );
  assert.equal(
    parseAsaasDateTime("2026-09-03T18:00:00")?.toISOString(),
    "2026-09-03T21:00:00.000Z",
  );
  assert.equal(parseAsaasDateTime(""), null);
  assert.equal(parseAsaasDateTime(null), null);
});

test("countdown", () => {
  assert.equal(formatCountdown(0), "00:00");
  assert.equal(formatCountdown(65_000), "01:05");
  assert.equal(formatCountdown(3_661_000), "1:01:01");
});
