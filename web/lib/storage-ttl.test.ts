import assert from "node:assert/strict";
import { test } from "node:test";
import { downloadUrlTtl } from "./storage.ts";

test("sem env var o link de download vale 7 dias", () => {
  delete process.env.R2_SIGNED_URL_TTL;
  assert.equal(downloadUrlTtl(), 604800);
});

test("valor inválido cai no default", () => {
  process.env.R2_SIGNED_URL_TTL = "abc";
  assert.equal(downloadUrlTtl(), 604800);
  process.env.R2_SIGNED_URL_TTL = "0";
  assert.equal(downloadUrlTtl(), 604800);
});

test("override menor que o teto é respeitado", () => {
  process.env.R2_SIGNED_URL_TTL = "600";
  assert.equal(downloadUrlTtl(), 600);
});

test("override acima do teto SigV4 é limitado a 7 dias", () => {
  process.env.R2_SIGNED_URL_TTL = "1209600";
  assert.equal(downloadUrlTtl(), 604800);
});
