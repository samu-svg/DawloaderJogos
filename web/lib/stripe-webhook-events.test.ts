import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cardStatusIsActive,
  chargeRefundKind,
  isCardSubscriptionId,
  periodEndToIso,
  stripeEventAction,
  subscriptionPeriodEndSeconds,
  subscriptionPriceIds,
  unknownPriceIds,
} from "./stripe-webhook-events.ts";

test("classifica os eventos que mexem no acesso", () => {
  assert.equal(stripeEventAction("checkout.session.completed"), "checkout");
  assert.equal(
    stripeEventAction("checkout.session.async_payment_succeeded"),
    "checkout",
  );
  assert.equal(stripeEventAction("customer.subscription.created"), "subscription");
  assert.equal(stripeEventAction("customer.subscription.updated"), "subscription");
  assert.equal(stripeEventAction("customer.subscription.deleted"), "subscription");
  assert.equal(stripeEventAction("charge.refunded"), "refund");
  assert.equal(stripeEventAction("charge.dispute.created"), "dispute");
  assert.equal(stripeEventAction("invoice.payment_failed"), "payment_failed");
});

test("evento desconhecido é ignorado, não credita nada", () => {
  assert.equal(stripeEventAction("payment_intent.succeeded"), "ignore");
  assert.equal(stripeEventAction("invoice.paid"), "ignore");
  assert.equal(stripeEventAction(""), "ignore");
  assert.equal(stripeEventAction("charge.refunded  "), "refund");
});

test("só active e trialing liberam o acesso", () => {
  assert.equal(cardStatusIsActive("active"), true);
  assert.equal(cardStatusIsActive("trialing"), true);
  assert.equal(cardStatusIsActive("past_due"), false);
  assert.equal(cardStatusIsActive("canceled"), false);
  assert.equal(cardStatusIsActive("unpaid"), false);
  assert.equal(cardStatusIsActive("incomplete"), false);
});

test("fim do período vem do item e cai na raiz como reserva", () => {
  assert.equal(
    subscriptionPeriodEndSeconds({
      items: { data: [{ current_period_end: 1800 }] },
      current_period_end: 900,
    }),
    1800,
  );
  assert.equal(
    subscriptionPeriodEndSeconds({ items: { data: [] }, current_period_end: 900 }),
    900,
  );
  assert.equal(subscriptionPeriodEndSeconds({}), null);
  assert.equal(subscriptionPeriodEndSeconds({ current_period_end: null }), null);
});

test("com vários itens vale o prazo mais longo", () => {
  assert.equal(
    subscriptionPeriodEndSeconds({
      items: {
        data: [
          { current_period_end: 1000 },
          { current_period_end: 5000 },
          { current_period_end: 2000 },
        ],
      },
    }),
    5000,
  );
});

test("período convertido para ISO", () => {
  assert.equal(periodEndToIso(0), null);
  assert.equal(periodEndToIso(null), null);
  assert.equal(periodEndToIso(1_800_000_000), "2027-01-15T08:00:00.000Z");
});

test("price fora do catálogo é detectado", () => {
  const subscription = {
    items: {
      data: [{ price: { id: "price_ok" } }, { price: { id: "price_intruso" } }],
    },
  };
  assert.deepEqual(subscriptionPriceIds(subscription), ["price_ok", "price_intruso"]);
  assert.deepEqual(unknownPriceIds(subscriptionPriceIds(subscription), ["price_ok"]), [
    "price_intruso",
  ]);
  assert.deepEqual(unknownPriceIds(["price_ok"], ["price_ok", "price_2"]), []);
  assert.deepEqual(subscriptionPriceIds({}), []);
});

test("estorno total e parcial são distinguidos", () => {
  assert.equal(chargeRefundKind({ amount: 4990, amount_refunded: 4990 }), "full");
  assert.equal(chargeRefundKind({ amount: 4990, amount_refunded: 1000 }), "partial");
  assert.equal(chargeRefundKind({ amount: 4990, amount_refunded: 0 }), "none");
  assert.equal(chargeRefundKind({}), "none");
});

test("flag refunded do Stripe vale como estorno total", () => {
  assert.equal(
    chargeRefundKind({ amount: 4990, amount_refunded: 1000, refunded: true }),
    "full",
  );
  assert.equal(chargeRefundKind({ amount: 4990, refunded: true }), "full");
  assert.equal(chargeRefundKind({ amount: 4990, refunded: false }), "none");
});

test("só sub_ é assinatura de cartão", () => {
  assert.equal(isCardSubscriptionId("sub_123"), true);
  assert.equal(isCardSubscriptionId("asaas:cus_1"), false);
  assert.equal(isCardSubscriptionId(null), false);
  assert.equal(isCardSubscriptionId(undefined), false);
  assert.equal(isCardSubscriptionId(""), false);
});
