import assert from "node:assert/strict";
import { test } from "node:test";
import { includeManifestDownloadUrls } from "./manifest-download-urls.ts";

test("cookie de navegador nunca leva URL assinada, nem para admin", () => {
  assert.equal(includeManifestDownloadUrls("cookie"), false);
});

test("Bearer do app e catálogo deliberadamente aberto levam URL assinada", () => {
  assert.equal(includeManifestDownloadUrls("bearer"), true);
  assert.equal(includeManifestDownloadUrls("open-catalog"), true);
});
