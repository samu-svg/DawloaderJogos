import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asaasCheckoutUserMessage,
  asaasPaymentIsExpired,
  asaasPaymentIsPaid,
  buildPixCheckoutView,
  formatCountdown,
  isAsaasPaymentId,
  isPixCheckoutView,
  parseAsaasDateTime,
  pixCheckoutPath,
  pixPlanPath,
  pixQrImageSrc,
  toQrView,
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

test("mensagem de CPF inválido do Asaas vira texto da UI", () => {
  assert.equal(
    asaasCheckoutUserMessage(new Error("CPF inválido")),
    "Informe um CPF válido para gerar o PIX.",
  );
  assert.equal(
    asaasCheckoutUserMessage({
      name: "AsaasApiError",
      message: "Não foi possível validar o CNPJ",
      status: 400,
    }),
    "Informe um CPF válido para gerar o PIX.",
  );
});

test("Asaas 400 com descrição própria aparece na UI", () => {
  assert.equal(
    asaasCheckoutUserMessage({
      name: "AsaasApiError",
      message: "O cliente informado é inválido.",
      status: 400,
    }),
    "O cliente informado é inválido.",
  );
  assert.equal(asaasCheckoutUserMessage(new Error("Asaas API error (502).")), null);
});

test("resposta de criar PIX é reconhecida sem nova navegação", () => {
  const view = buildPixCheckoutView({
    payment: { id: "pay_abc123", status: "PENDING", value: 49.9 },
    planId: "1m",
    planTitle: "1 mês",
    priceLabel: "R$ 49,90",
    qr: toQrView({
      encodedImage: "abc",
      payload: "00020126",
      expirationDate: "2026-09-06 18:00:00",
    }),
  });
  assert.equal(isPixCheckoutView(view), true);
  assert.equal(view.qr?.payload, "00020126");
  assert.equal(isPixCheckoutView({ url: "/assinar/pix?payment=pay_abc123" }), false);
});

test("cobrança criada sem QR ainda é uma view válida", () => {
  const view = buildPixCheckoutView({
    payment: { id: "pay_pending1", status: "PENDING", value: 49.9 },
    planId: "2m",
    planTitle: "2 meses",
    priceLabel: "R$ 89,90",
    qr: null,
  });
  assert.equal(isPixCheckoutView(view), true);
  assert.equal(view.qr, null);
  assert.equal(view.paid, false);
});
