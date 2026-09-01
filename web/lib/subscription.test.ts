import assert from "node:assert/strict";
import { test } from "node:test";
import { subscriptionIsActive } from "./subscription-active.ts";

test("assinatura ativa sem data de fim", () => {
  assert.equal(subscriptionIsActive({ status: "active" }), true);
});

test("assinatura expirada pelo current_period_end", () => {
  const past = new Date(Date.now() - 86_400_000).toISOString();
  assert.equal(
    subscriptionIsActive({ status: "active", current_period_end: past }),
    false,
  );
});

test("pré-pago PIX ainda válido", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal(
    subscriptionIsActive({ status: "active", current_period_end: future }),
    true,
  );
});

test("status cancelado não libera", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal(
    subscriptionIsActive({ status: "canceled", current_period_end: future }),
    false,
  );
});
