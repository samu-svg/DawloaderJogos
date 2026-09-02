import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sanitizeSupportText,
  validateSupportBody,
  validateSupportSubject,
  parseSupportStatus,
} from "./support.ts";

test("sanitize remove null e controles", () => {
  assert.equal(sanitizeSupportText("oi\u0000\u0001mundo"), "oimundo");
  assert.equal(sanitizeSupportText("  a\r\nb  "), "a\nb");
});

test("assunto válido", () => {
  const ok = validateSupportSubject("Problema no download");
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.value, "Problema no download");
});

test("assunto curto ou longo falha", () => {
  assert.equal(validateSupportSubject("ab").ok, false);
  assert.equal(validateSupportSubject("x".repeat(121)).ok, false);
});

test("corpo válido e limites", () => {
  assert.equal(validateSupportBody("Ajuda").ok, true);
  assert.equal(validateSupportBody("").ok, false);
  assert.equal(validateSupportBody("y".repeat(4001)).ok, false);
});

test("parse status", () => {
  assert.equal(parseSupportStatus("open"), "open");
  assert.equal(parseSupportStatus("hack"), null);
});
