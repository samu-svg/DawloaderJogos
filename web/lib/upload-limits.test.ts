import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_UPLOAD_BYTES,
  isAllowedUploadContentType,
  isAllowedUploadSize,
  resolveUploadContentType,
} from "./upload-limits.ts";

test("aceita zip e octet-stream, inclusive com charset", () => {
  assert.equal(isAllowedUploadContentType("application/zip"), true);
  assert.equal(isAllowedUploadContentType("application/x-zip-compressed"), true);
  assert.equal(isAllowedUploadContentType("application/octet-stream"), true);
  assert.equal(
    isAllowedUploadContentType("application/zip; charset=utf-8"),
    true,
  );
  assert.equal(resolveUploadContentType(undefined), "application/octet-stream");
  assert.equal(resolveUploadContentType(""), "application/octet-stream");
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
