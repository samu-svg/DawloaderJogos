import assert from "node:assert/strict";
import { test } from "node:test";
import { recoveryMailConfigured, authMailConfigured } from "./password-recovery-mail.ts";

test("recovery mail exige RESEND_API_KEY", () => {
  delete process.env.RESEND_API_KEY;
  assert.equal(recoveryMailConfigured(), false);
  assert.equal(authMailConfigured(), false);
  process.env.RESEND_API_KEY = "re_test";
  assert.equal(recoveryMailConfigured(), true);
  assert.equal(authMailConfigured(), true);
  delete process.env.RESEND_API_KEY;
});
