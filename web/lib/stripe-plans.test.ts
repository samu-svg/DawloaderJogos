import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accessMonthsFromMetadata,
  formatBrlFromCents,
  getPlan,
  isPaymentMethod,
  isPlanId,
  knownCardPriceIds,
  STRIPE_PLANS,
  stripePriceIdFor,
} from "./stripe-plans.ts";

test("planos têm meses corretos", () => {
  assert.equal(getPlan("1m").months, 1);
  assert.equal(getPlan("2m").months, 2);
  assert.equal(getPlan("3m").months, 3);
});

test("plano de 1 mês é o recomendado e aparece no centro", () => {
  assert.deepEqual(
    STRIPE_PLANS.map((plan) => plan.id),
    ["2m", "1m", "3m"],
  );
  assert.equal(STRIPE_PLANS[1].id, "1m");
  assert.equal(getPlan("1m").recommended, true);
  assert.equal(
    STRIPE_PLANS.filter((plan) => plan.recommended).length,
    1,
  );
});

test("preço é inteiro em centavos", () => {
  assert.equal(getPlan("1m").priceCents, 4990);
  assert.equal(getPlan("2m").priceCents, 8990);
  assert.equal(getPlan("3m").priceCents, 15990);
  for (const plan of STRIPE_PLANS) {
    assert.equal(Number.isInteger(plan.priceCents), true);
  }
});

test("rótulo é derivado dos centavos, nunca o contrário", () => {
  assert.equal(getPlan("1m").priceLabel, "R$ 49,90");
  assert.equal(getPlan("2m").priceLabel, "R$ 89,90");
  assert.equal(getPlan("3m").priceLabel, "R$ 159,90");
});

test("formata centavos em real", () => {
  assert.equal(formatBrlFromCents(0), "R$ 0,00");
  assert.equal(formatBrlFromCents(5), "R$ 0,05");
  assert.equal(formatBrlFromCents(100), "R$ 1,00");
  assert.equal(formatBrlFromCents(123456), "R$ 1.234,56");
  assert.throws(() => formatBrlFromCents(-1));
  assert.throws(() => formatBrlFromCents(49.9));
});

test("validação de plan e método", () => {
  assert.equal(isPlanId("1m"), true);
  assert.equal(isPlanId("4m"), false);
  assert.equal(isPaymentMethod("pix"), true);
  assert.equal(isPaymentMethod("boleto"), false);
});

test("price do plano é sempre o de assinatura no cartão", (t) => {
  t.after(() => {
    delete process.env.STRIPE_PRICE_1M_SUB;
    delete process.env.STRIPE_PRICE_2M_SUB;
    delete process.env.STRIPE_PRICE_ID;
  });

  process.env.STRIPE_PRICE_1M_SUB = "price_1m";
  process.env.STRIPE_PRICE_2M_SUB = "price_2m";
  delete process.env.STRIPE_PRICE_3M_SUB;

  assert.equal(stripePriceIdFor("1m"), "price_1m");
  assert.equal(stripePriceIdFor("3m"), null);
  assert.deepEqual(
    knownCardPriceIds().sort(),
    ["price_1m", "price_2m"],
  );
});

test("STRIPE_PRICE_ID antigo só vale para o plano de 1 mês", (t) => {
  t.after(() => {
    delete process.env.STRIPE_PRICE_ID;
  });

  delete process.env.STRIPE_PRICE_1M_SUB;
  delete process.env.STRIPE_PRICE_2M_SUB;
  process.env.STRIPE_PRICE_ID = "price_legado";

  assert.equal(stripePriceIdFor("1m"), "price_legado");
  assert.equal(stripePriceIdFor("2m"), null);
});

test("access_months vem de metadata", () => {
  assert.equal(accessMonthsFromMetadata({ access_months: "2" }), 2);
  assert.equal(accessMonthsFromMetadata({ plan: "3m" }), 3);
  assert.equal(accessMonthsFromMetadata({ plan: "invalid" }), null);
  assert.equal(accessMonthsFromMetadata(null), null);
});
