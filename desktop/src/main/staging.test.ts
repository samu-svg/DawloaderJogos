import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getFreeBytes, safeStagingId, stagingEntryDir } from "./staging.ts";

test("safeStagingId remove caracteres perigosos", () => {
  assert.equal(safeStagingId("abc-123"), "abc-123");
  assert.equal(safeStagingId("../x"), ".._x");
  assert.ok(!safeStagingId("a/b\\c").includes("/") && !safeStagingId("a/b\\c").includes("\\"));
});

test("stagingEntryDir junta a raiz com o id", () => {
  const dir = stagingEntryDir("/tmp/staging", "entry-1");
  assert.match(dir.replace(/\\/g, "/"), /\/entry-1$/);
});

test("getFreeBytes na raiz do disco não tenta mkdir", async () => {
  const root = process.platform === "win32" ? "C:\\" : "/";
  const bytes = await getFreeBytes(root);
  assert.ok(Number.isFinite(bytes));
  assert.ok(bytes >= 0);
});

test("getFreeBytes não cria pasta inexistente", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "montahd-free-"));
  try {
    const missing = path.join(parent, "nao-existe");
    const bytes = await getFreeBytes(missing);
    assert.ok(Number.isFinite(bytes));
    assert.ok(bytes >= 0);
    assert.equal(existsSync(missing), false);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
