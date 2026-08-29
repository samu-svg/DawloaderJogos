import test from "node:test";
import assert from "node:assert/strict";
import { computeHdFingerprint } from "./hd-fingerprint.ts";

test("fingerprint e estavel para a mesma pasta", () => {
  const a = computeHdFingerprint("D:\\Xbox360");
  const b = computeHdFingerprint("D:/Xbox360");
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test("fingerprint muda para pastas diferentes", () => {
  const a = computeHdFingerprint("D:\\Xbox360");
  const b = computeHdFingerprint("E:\\Xbox360");
  assert.notEqual(a, b);
});
