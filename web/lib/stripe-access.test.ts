import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkoutSessionGrantsLifetimeAccess,
  userIdFromCheckoutSession,
  userIdFromPaymentIntent,
} from "./stripe-access.ts";

test("pagamento único pago libera acesso vitalício", () => {
  assert.equal(
    checkoutSessionGrantsLifetimeAccess({
      mode: "payment",
      payment_status: "paid",
    }),
    true,
  );
});

test("PIX pendente não libera acesso", () => {
  assert.equal(
    checkoutSessionGrantsLifetimeAccess({
      mode: "payment",
      payment_status: "unpaid",
    }),
    false,
  );
});

test("checkout de assinatura não usa o unlock one-time", () => {
  assert.equal(
    checkoutSessionGrantsLifetimeAccess({
      mode: "subscription",
      payment_status: "paid",
    }),
    false,
  );
});

test("user id vem de client_reference_id ou metadata", () => {
  assert.equal(
    userIdFromCheckoutSession({
      client_reference_id: "user-1",
      metadata: { app_user_id: "user-2" },
    }),
    "user-1",
  );
  assert.equal(
    userIdFromCheckoutSession({
      client_reference_id: null,
      metadata: { app_user_id: "user-2" },
    }),
    "user-2",
  );
  assert.equal(
    userIdFromPaymentIntent({
      metadata: { supabase_user_id: "user-3" },
    }),
    "user-3",
  );
});
