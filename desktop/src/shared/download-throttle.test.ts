import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseMaxBytesPerSecond,
  throttleDelayMs,
} from "./download-throttle.ts";

test("sem teto ou chunk vazio não espera", () => {
  assert.equal(throttleDelayMs(1024, 0), 0);
  assert.equal(throttleDelayMs(0, 256_000), 0);
});

test("256 KiB/s espera ~1s para 256 KiB", () => {
  assert.equal(throttleDelayMs(256 * 1024, 256 * 1024), 1000);
});

test("parseMaxBytesPerSecond ignora valores inválidos", () => {
  assert.equal(parseMaxBytesPerSecond(undefined), 0);
  assert.equal(parseMaxBytesPerSecond(-1), 0);
  assert.equal(parseMaxBytesPerSecond(128000.9), 128000);
});
