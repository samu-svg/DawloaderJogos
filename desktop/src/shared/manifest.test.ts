import assert from "node:assert/strict";
import test from "node:test";
import {
  assertHostedSha256,
  normalizeManifestSha256,
} from "./manifest.ts";

const HASH = "a".repeat(64);

test("normalizeManifestSha256 aceita hex de 64 chars e descarta o resto", () => {
  assert.equal(normalizeManifestSha256(` ${HASH.toUpperCase()} `), HASH);
  assert.equal(normalizeManifestSha256(null), undefined);
  assert.equal(normalizeManifestSha256(""), undefined);
  assert.equal(normalizeManifestSha256("abc"), undefined);
  assert.equal(normalizeManifestSha256("g".repeat(64)), undefined);
});

test("hosted sem SHA-256 é recusado; external passa", () => {
  assert.throws(() => assertHostedSha256("hosted", undefined), /SHA-256/);
  assert.throws(() => assertHostedSha256("hosted", "abc"), /SHA-256/);
  assert.doesNotThrow(() => assertHostedSha256("hosted", HASH));
  assert.doesNotThrow(() => assertHostedSha256("external", undefined));
  assert.doesNotThrow(() => assertHostedSha256(undefined, undefined));
});
