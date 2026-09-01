import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadLastHdRoot, saveLastHdRoot } from "./last-hd-root.ts";

test("grava e relê o último HD se a pasta ainda existir", () => {
  const userData = mkdtempSync(path.join(os.tmpdir(), "montahd-last-hd-"));
  const hdRoot = path.join(userData, "hd");
  mkdirSync(hdRoot);

  try {
    const saved = saveLastHdRoot(userData, hdRoot);
    assert.equal(path.resolve(saved), path.resolve(hdRoot));
    const loaded = loadLastHdRoot(userData);
    assert.equal(loaded, path.resolve(hdRoot));
  } finally {
    rmSync(userData, { recursive: true, force: true });
  }
});

test("ignora HD lembrado se a pasta sumiu", () => {
  const userData = mkdtempSync(path.join(os.tmpdir(), "montahd-last-hd-"));
  const hdRoot = path.join(userData, "hd");
  mkdirSync(hdRoot);

  try {
    saveLastHdRoot(userData, hdRoot);
    rmSync(hdRoot, { recursive: true, force: true });
    assert.equal(loadLastHdRoot(userData), null);
  } finally {
    rmSync(userData, { recursive: true, force: true });
  }
});
