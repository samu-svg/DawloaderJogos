import assert from "node:assert/strict";
import test from "node:test";
import {
  FAT32_MAX_FILE_BYTES,
  FAT32_LIMIT_LABEL,
  installSpaceNotice,
  isOverFat32Limit,
  largestEntryBytes,
  largestPcStagingBytes,
  notEnoughPcSpaceMessage,
  sizesNeedingPcStaging,
} from "./pc-space.ts";

test("largestEntryBytes usa o maior tamanho da seleção", () => {
  assert.equal(largestEntryBytes([100, 8000, 50]), 8000);
  assert.equal(largestEntryBytes([]), 0);
});

test("isOverFat32Limit marca arquivos acima de 4 GB", () => {
  assert.equal(isOverFat32Limit(FAT32_MAX_FILE_BYTES), false);
  assert.equal(isOverFat32Limit(FAT32_MAX_FILE_BYTES + 1), true);
});

test("sizesNeedingPcStaging ignora jogos que cabem no FAT32", () => {
  const small = 3 * 1024 * 1024 * 1024;
  const large = 5 * 1024 * 1024 * 1024;
  assert.deepEqual(sizesNeedingPcStaging([small, large, 100]), [large]);
  assert.equal(largestPcStagingBytes([small, 200]), 0);
  assert.equal(largestPcStagingBytes([small, large]), large);
});

test("aviso: só HD quando todos cabem no FAT32", () => {
  const text = installSpaceNotice([100, 2 * 1024 * 1024 * 1024]);
  assert.match(text, /direto no HD/);
  assert.doesNotMatch(text, /processados no PC/);
  assert.match(text, new RegExp(FAT32_LIMIT_LABEL));
});

test("aviso: PC só para jogos acima de 4 GB", () => {
  const text = installSpaceNotice([100, 7 * 1024 * 1024 * 1024]);
  assert.match(text, /direto no HD/);
  assert.match(text, /processados no PC/);
  assert.match(text, /7(\.0)? GB/);
  assert.match(text, /FAT32/);
});

test("mensagem de espaço insuficiente inclui livre e necessário", () => {
  const message = notEnoughPcSpaceMessage(5 * 1024 * 1024 * 1024, 1 * 1024 * 1024 * 1024);
  assert.match(message, /PC/);
  assert.match(message, /1(\.0)? GB/);
  assert.match(message, /5(\.0)? GB/);
});
