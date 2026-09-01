import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accessMonthsFromMetadata,
  getPlan,
  isPaymentMethod,
  isPlanId,
} from "./stripe-plans.ts";

test("planos têm meses corretos", () => {
  assert.equal(getPlan("1m").months, 1);
  assert.equal(getPlan("2m").months, 2);
  assert.equal(getPlan("3m").months, 3);
});

test("validação de plan e método", () => {
  assert.equal(isPlanId("1m"), true);
  assert.equal(isPlanId("4m"), false);
  assert.equal(isPaymentMethod("pix"), true);
  assert.equal(isPaymentMethod("boleto"), false);
});

test("access_months vem de metadata", () => {
  assert.equal(accessMonthsFromMetadata({ access_months: "2" }), 2);
  assert.equal(accessMonthsFromMetadata({ plan: "3m" }), 3);
  assert.equal(accessMonthsFromMetadata({ plan: "invalid" }), null);
  assert.equal(accessMonthsFromMetadata(null), null);
});
