import assert from "node:assert/strict";
import { test } from "node:test";
import { safeInternalPath } from "./safe-redirect.ts";

test("aceita path relativo interno", () => {
  assert.equal(safeInternalPath("/baixar"), "/baixar");
  assert.equal(safeInternalPath("/assinar?x=1"), "/assinar?x=1");
});

test("bloqueia open redirect", () => {
  assert.equal(safeInternalPath("//evil.com"), "/baixar");
  assert.equal(safeInternalPath("https://evil.com"), "/baixar");
  assert.equal(safeInternalPath("/\\evil.com"), "/baixar");
});
