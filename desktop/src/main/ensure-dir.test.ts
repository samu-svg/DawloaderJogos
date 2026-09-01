import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ensureDir, isFilesystemRoot } from "./ensure-dir.ts";

test("isFilesystemRoot reconhece a raiz do disco", () => {
  if (process.platform === "win32") {
    assert.equal(isFilesystemRoot("C:\\"), true);
    assert.equal(isFilesystemRoot("D:\\"), true);
    assert.equal(isFilesystemRoot("D:\\Games"), false);
    assert.equal(isFilesystemRoot("D:\\.montahd"), false);
  } else {
    assert.equal(isFilesystemRoot("/"), true);
    assert.equal(isFilesystemRoot("/tmp"), false);
  }
});

test("ensureDir na raiz do disco não lança", async () => {
  const root = process.platform === "win32" ? "C:\\" : "/";
  await ensureDir(root);
});

test("statfs na raiz do disco funciona depois de ensureDir", async () => {
  const { statfs } = await import("node:fs/promises");
  const root = process.platform === "win32" ? "C:\\" : "/";
  await ensureDir(root);
  const stats = await statfs(root);
  assert.ok(Number(stats.bavail) * Number(stats.bsize) >= 0);
});

test("ensureDir cria pastas aninhadas", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "montahd-mkdir-"));
  try {
    const nested = path.join(parent, "a", "b");
    await ensureDir(nested);
    const info = await stat(nested);
    assert.equal(info.isDirectory(), true);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
