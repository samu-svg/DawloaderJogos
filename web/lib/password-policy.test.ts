import assert from "node:assert/strict";
import { test } from "node:test";
import { PASSWORD_MAX_AGE_DAYS, passwordIsExpired } from "./password-policy.ts";

test("senha recente não expirou", () => {
  assert.equal(passwordIsExpired(new Date()), false);
});

test("senha com mais de 90 dias expirou", () => {
  const old = new Date(Date.now() - (PASSWORD_MAX_AGE_DAYS + 1) * 24 * 60 * 60 * 1000);
  assert.equal(passwordIsExpired(old), true);
});
