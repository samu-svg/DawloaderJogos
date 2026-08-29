import assert from "node:assert/strict";
import test from "node:test";
import { safeStagingId, stagingEntryDir } from "./staging.ts";

test("safeStagingId remove caracteres perigosos", () => {
  assert.equal(safeStagingId("abc-123"), "abc-123");
  assert.equal(safeStagingId("../x"), ".._x");
  assert.ok(!safeStagingId("a/b\\c").includes("/") && !safeStagingId("a/b\\c").includes("\\"));
});

test("stagingEntryDir junta a raiz com o id", () => {
  const dir = stagingEntryDir("/tmp/staging", "entry-1");
  assert.match(dir.replace(/\\/g, "/"), /\/entry-1$/);
});
