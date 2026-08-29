import assert from "node:assert/strict";
import { test } from "node:test";
import { downloadUrlTtl } from "./storage.ts";

test("sem env var o link de download vale 30 minutos", () => {
  delete process.env.R2_SIGNED_URL_TTL;
  assert.equal(downloadUrlTtl(), 1800);
});

test("valor inválido cai no default", () => {
  process.env.R2_SIGNED_URL_TTL = "abc";
  assert.equal(downloadUrlTtl(), 1800);
  process.env.R2_SIGNED_URL_TTL = "0";
  assert.equal(downloadUrlTtl(), 1800);
});

test("override menor que o teto é respeitado", () => {
  process.env.R2_SIGNED_URL_TTL = "600";
  assert.equal(downloadUrlTtl(), 600);
});

test("override absurdo é limitado a 6 horas", () => {
  process.env.R2_SIGNED_URL_TTL = "604800";
  assert.equal(downloadUrlTtl(), 21600);
});
