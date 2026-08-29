import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptSensitive, encryptSensitive, fingerprintLookup, isEncrypted } from "./crypto.ts";

test("AES-256-GCM roundtrip", () => {
  process.env.ENCRYPTION_KEY = "a".repeat(64);
  const secret = "abc123fingerprintvalue";
  const cipher = encryptSensitive(secret);
  assert.equal(isEncrypted(cipher), true);
  assert.equal(decryptSensitive(cipher), secret);
  assert.notEqual(cipher, encryptSensitive(secret));
});

test("lookup HMAC é estável", () => {
  process.env.ENCRYPTION_KEY = "a".repeat(64);
  const a = fingerprintLookup("AbC");
  const b = fingerprintLookup("abc");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});
