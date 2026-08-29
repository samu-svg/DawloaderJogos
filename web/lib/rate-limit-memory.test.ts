import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  memoryLimit,
  memoryLimitKeyCount,
  resetMemoryLimit,
  windowToMs,
} from "./rate-limit-memory.ts";

beforeEach(() => {
  resetMemoryLimit();
});

test("converte janelas para milissegundos", () => {
  assert.equal(windowToMs("250 ms"), 250);
  assert.equal(windowToMs("30 s"), 30_000);
  assert.equal(windowToMs("1 m"), 60_000);
  assert.equal(windowToMs("2 h"), 7_200_000);
});

test("bloqueia depois de estourar o limite", () => {
  for (let i = 0; i < 3; i += 1) {
    assert.equal(memoryLimit("login:ip:1.1.1.1", 3, 60_000), true);
  }
  assert.equal(memoryLimit("login:ip:1.1.1.1", 3, 60_000), false);
  assert.equal(memoryLimit("login:ip:1.1.1.1", 3, 60_000), false);
});

test("identidades diferentes têm cotas independentes", () => {
  assert.equal(memoryLimit("login:ip:1.1.1.1", 1, 60_000), true);
  assert.equal(memoryLimit("login:ip:1.1.1.1", 1, 60_000), false);
  assert.equal(memoryLimit("login:ip:2.2.2.2", 1, 60_000), true);
  assert.equal(memoryLimit("login:user:abc", 1, 60_000), true);
});

test("libera novamente quando a janela expira", async () => {
  assert.equal(memoryLimit("manifest:ip:1.1.1.1", 2, 40), true);
  assert.equal(memoryLimit("manifest:ip:1.1.1.1", 2, 40), true);
  assert.equal(memoryLimit("manifest:ip:1.1.1.1", 2, 40), false);

  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal(memoryLimit("manifest:ip:1.1.1.1", 2, 40), true);
});

test("a limpeza descarta identidades com janela expirada", async () => {
  for (let i = 0; i < 300; i += 1) {
    memoryLimit(`upload:ip:10.0.0.${i}`, 5, 20);
  }
  const beforeSweep = memoryLimitKeyCount();
  assert.ok(beforeSweep > 0);

  await new Promise((resolve) => setTimeout(resolve, 40));

  // The sweep is amortized, so it only runs inside a later call.
  for (let i = 0; i < 256; i += 1) {
    memoryLimit("upload:ip:203.0.113.7", 1000, 20);
  }

  assert.ok(memoryLimitKeyCount() < beforeSweep);
});
