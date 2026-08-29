import assert from "node:assert/strict";
import { test } from "node:test";
import { PASSWORD_MAX_AGE_DAYS, passwordIsExpired } from "./password-policy.ts";

test("senha recente não expirou", () => {
  assert.equal(passwordIsExpired(new Date()), false);
});

test("ausência de data conta como senha vencida", () => {
  assert.equal(passwordIsExpired(new Date(0)), true);
});
