import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { requireHostedSha256, normalizeSha256 } from "./sha256.ts";
import { Sha256 } from "./sha256-stream.ts";

test("normalizeSha256 só aceita 64 hex", () => {
  const hash = "a".repeat(64);
  assert.equal(normalizeSha256(` ${hash.toUpperCase()} `), hash);
  assert.equal(normalizeSha256("abc"), null);
});

test("hosted exige SHA-256; external aceita vazio", () => {
  assert.equal(requireHostedSha256("hosted", null).ok, false);
  assert.equal(requireHostedSha256("hosted", "a".repeat(64)).ok, true);
  assert.equal(requireHostedSha256("external", null).ok, true);
});

function hashHex(chunks: Uint8Array[]): string {
  const hasher = new Sha256();
  for (const chunk of chunks) hasher.update(chunk);
  return hasher.digestHex();
}

test("Sha256 incremental bate com crypto do Node em vários tamanhos", () => {
  const cases = [0, 1, 55, 56, 63, 64, 65, 127, 128, 1000, 8192, 65537];
  for (const size of cases) {
    const buf = Buffer.alloc(size, size % 251);
    const expected = createHash("sha256").update(buf).digest("hex");
    const mid = Math.floor(size / 2);
    const actual = hashHex([
      new Uint8Array(buf.subarray(0, mid)),
      new Uint8Array(buf.subarray(mid)),
    ]);
    assert.equal(actual, expected, `size ${size}`);
  }
});

test("Sha256 vetores conhecidos", () => {
  assert.equal(
    hashHex([new Uint8Array()]),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assert.equal(
    hashHex([new TextEncoder().encode("abc")]),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
