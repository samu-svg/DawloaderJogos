import assert from "node:assert/strict";
import { test } from "node:test";
import {
  afterAuthPath,
  DEFAULT_FREE_DOWNLOAD_BYTES_PER_SECOND,
  freeDownloadSpeedLabel,
  freeMaxBytesPerSecond,
  isDownloadPlan,
  maxBytesPerSecondForPlan,
} from "./plan-limits.ts";

test("plano de download só aceita free ou paid", () => {
  assert.equal(isDownloadPlan("free"), true);
  assert.equal(isDownloadPlan("paid"), true);
  assert.equal(isDownloadPlan("premium"), false);
});

test("pago não tem teto de velocidade", () => {
  assert.equal(maxBytesPerSecondForPlan("paid"), 0);
});

test("grátis usa o default ou a env", () => {
  const previous = process.env.FREE_DOWNLOAD_BYTES_PER_SECOND;
  delete process.env.FREE_DOWNLOAD_BYTES_PER_SECOND;
  assert.equal(freeMaxBytesPerSecond(), DEFAULT_FREE_DOWNLOAD_BYTES_PER_SECOND);
  assert.equal(
    maxBytesPerSecondForPlan("free"),
    DEFAULT_FREE_DOWNLOAD_BYTES_PER_SECOND,
  );

  process.env.FREE_DOWNLOAD_BYTES_PER_SECOND = "128000";
  assert.equal(freeMaxBytesPerSecond(), 128000);

  process.env.FREE_DOWNLOAD_BYTES_PER_SECOND = "10";
  assert.equal(freeMaxBytesPerSecond(), DEFAULT_FREE_DOWNLOAD_BYTES_PER_SECOND);

  if (previous === undefined) {
    delete process.env.FREE_DOWNLOAD_BYTES_PER_SECOND;
  } else {
    process.env.FREE_DOWNLOAD_BYTES_PER_SECOND = previous;
  }
});

test("rótulo de velocidade do grátis é 5 Mbps no default", () => {
  const previous = process.env.FREE_DOWNLOAD_BYTES_PER_SECOND;
  delete process.env.FREE_DOWNLOAD_BYTES_PER_SECOND;
  assert.equal(freeDownloadSpeedLabel(), "5 Mbps");
  if (previous === undefined) {
    delete process.env.FREE_DOWNLOAD_BYTES_PER_SECOND;
  } else {
    process.env.FREE_DOWNLOAD_BYTES_PER_SECOND = previous;
  }
});

test("depois do login, Completo vai para lote e Grátis para o catálogo", () => {
  assert.equal(afterAuthPath(true), "/baixar");
  assert.equal(afterAuthPath(false), "/");
});
