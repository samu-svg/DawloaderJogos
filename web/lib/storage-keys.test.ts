import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStorageKey, isValidImportStorageKey, storageKeyBelongsToPortfolio } from "./storage-keys.ts";

const portfolioId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

test("builds keys under the portfolio prefix", () => {
  const key = buildStorageKey(portfolioId, "Halo 3.zip");
  assert.ok(key.startsWith(`${portfolioId}/`));
  assert.ok(key.endsWith("Halo_3.zip"));
});

test("accepts keys owned by the portfolio", () => {
  const key = buildStorageKey(portfolioId, "game.zip");
  assert.equal(storageKeyBelongsToPortfolio(key, portfolioId), true);
  assert.equal(storageKeyBelongsToPortfolio(`${portfolioId}/../other`, portfolioId), false);
  assert.equal(storageKeyBelongsToPortfolio("other/id/file.zip", portfolioId), false);
});

test("aceita import só sob jogos/", () => {
  assert.equal(isValidImportStorageKey("jogos/Halo 3.zip"), true);
  assert.equal(isValidImportStorageKey("/jogos/a.zip"), true);
  assert.equal(isValidImportStorageKey("jogos/"), false);
  assert.equal(isValidImportStorageKey("../secret"), false);
  assert.equal(isValidImportStorageKey("secrets/key.zip"), false);
  assert.equal(isValidImportStorageKey("jogos/../etc/passwd"), false);
});
