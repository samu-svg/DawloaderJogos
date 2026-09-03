import assert from "node:assert/strict";
import { test } from "node:test";
import { userIdFromCheckoutSession } from "./stripe-access.ts";

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
    userIdFromCheckoutSession({
      client_reference_id: null,
      metadata: { supabase_user_id: "user-3" },
    }),
    "user-3",
  );
  assert.equal(
    userIdFromCheckoutSession({ client_reference_id: null, metadata: {} }),
    null,
  );
});
