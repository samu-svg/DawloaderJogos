import assert from "node:assert/strict";
import test from "node:test";
import {
  FAT32_MAX_FILE_BYTES,
  isOverFat32Limit,
  largestEntryBytes,
  notEnoughPcSpaceMessage,
  pcSpaceShortHint,
  pcSpaceWarning,
} from "./pc-space.ts";

test("largestEntryBytes usa o maior tamanho da seleção", () => {
  assert.equal(largestEntryBytes([100, 8000, 50]), 8000);
  assert.equal(largestEntryBytes([]), 0);
});

test("isOverFat32Limit marca arquivos acima de 4 GB", () => {
  assert.equal(isOverFat32Limit(FAT32_MAX_FILE_BYTES), false);
  assert.equal(isOverFat32Limit(FAT32_MAX_FILE_BYTES + 1), true);
});

test("aviso menciona PC, HD e o tamanho do maior jogo", () => {
  const text = pcSpaceWarning(7 * 1024 * 1024 * 1024);
  assert.match(text, /PC/);
  assert.match(text, /HD/);
  assert.match(text, /7(\.0)? GB/);
  assert.match(text, /apagados/);

  const hint = pcSpaceShortHint(1024 * 1024 * 1024);
  assert.match(hint, /1(\.0)? GB/);
  assert.match(hint, /computador/);
});

test("mensagem de espaço insuficiente inclui livre e necessário", () => {
  const message = notEnoughPcSpaceMessage(5 * 1024 * 1024 * 1024, 1 * 1024 * 1024 * 1024);
  assert.match(message, /PC/);
  assert.match(message, /1(\.0)? GB/);
  assert.match(message, /5(\.0)? GB/);
});
