import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_UPLOAD_BYTES,
  fileNameLooksLikeZip,
  isAllowedUploadContentType,
  isAllowedUploadSize,
  resolveUploadContentType,
  uploadedSizeMatchesDeclaration,
} from "./upload-limits.ts";

test("aceita zip; octet-stream só com nome .zip", () => {
  assert.equal(isAllowedUploadContentType("application/zip"), true);
  assert.equal(isAllowedUploadContentType("application/x-zip-compressed"), true);
  assert.equal(
    isAllowedUploadContentType("application/zip; charset=utf-8"),
    true,
  );
  assert.equal(isAllowedUploadContentType("application/octet-stream"), false);
  assert.equal(
    isAllowedUploadContentType("application/octet-stream", "jogo.zip"),
    true,
  );
  assert.equal(
    isAllowedUploadContentType("application/octet-stream", "jogo.exe"),
    false,
  );
  assert.equal(resolveUploadContentType(undefined, "pacote.zip"), "application/zip");
  assert.equal(resolveUploadContentType(""), "application/octet-stream");
  assert.equal(fileNameLooksLikeZip("Games/a.ZIP"), true);
  assert.equal(fileNameLooksLikeZip("a.rar"), false);
});

test("rejeita content-type fora da allowlist", () => {
  assert.equal(isAllowedUploadContentType("text/html"), false);
  assert.equal(isAllowedUploadContentType("application/pdf"), false);
  assert.equal(isAllowedUploadContentType("image/png"), false);
  assert.equal(isAllowedUploadContentType("application/x-msdownload"), false);
});

test("teto de 128 GiB e tamanhos inválidos", () => {
  assert.equal(MAX_UPLOAD_BYTES, 128 * 1024 * 1024 * 1024);
  assert.equal(isAllowedUploadSize(1), true);
  assert.equal(isAllowedUploadSize(MAX_UPLOAD_BYTES), true);
  assert.equal(isAllowedUploadSize(MAX_UPLOAD_BYTES + 1), false);
  assert.equal(isAllowedUploadSize(0), false);
  assert.equal(isAllowedUploadSize(-1), false);
  assert.equal(isAllowedUploadSize(Number.NaN), false);
  assert.equal(isAllowedUploadSize(Number.POSITIVE_INFINITY), false);
});

test("complete recusa objeto maior que o tamanho declarado", () => {
  assert.equal(uploadedSizeMatchesDeclaration(100, 100), true);
  assert.equal(uploadedSizeMatchesDeclaration(100, 99), true);
  assert.equal(uploadedSizeMatchesDeclaration(100, 101), false);
  assert.equal(uploadedSizeMatchesDeclaration(0, 50), false);
  assert.equal(uploadedSizeMatchesDeclaration(Number.NaN, 50), false);
});
