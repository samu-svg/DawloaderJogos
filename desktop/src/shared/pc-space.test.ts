import assert from "node:assert/strict";
import test from "node:test";
import {
  FAT32_MAX_FILE_BYTES,
  FAT32_LIMIT_LABEL,
  hasSpaceForPrefetch,
  installSpaceNotice,
  isOverFat32Limit,
  isValidInstallMode,
  largestEntryBytes,
  largestPcStagingBytes,
  maxConcurrentExtracts,
  notEnoughPcSpaceMessage,
  orderDownloadQueue,
  peakConcurrentBytes,
  peakPcStagingBytes,
  resolveDownloadTarget,
  resolveKnownSize,
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

test("resolveKnownSize prefere o tamanho remoto ao do catálogo", () => {
  const catalog = 6 * 1024 * 1024 * 1024;
  const probed = 3 * 1024 * 1024 * 1024;
  assert.equal(resolveKnownSize(catalog, probed), probed);
  assert.equal(resolveKnownSize(catalog, 0), catalog);
  assert.equal(resolveKnownSize(0, 0), 0);
});

test("resolveDownloadTarget manda jogos até 4 GB para o HD", () => {
  const small = 3 * 1024 * 1024 * 1024;
  const large = 5 * 1024 * 1024 * 1024;
  assert.equal(resolveDownloadTarget(small), "hd");
  assert.equal(resolveDownloadTarget(large), "pc");
  assert.equal(resolveDownloadTarget(0), "hd");
  assert.equal(resolveDownloadTarget(large, small), "hd");
  assert.equal(resolveDownloadTarget(small, large), "pc");
});

test("hasSpaceForPrefetch exige tamanho conhecido ou margem mínima", () => {
  const buffer = 512 * 1024 * 1024;
  assert.equal(hasSpaceForPrefetch(buffer, 0), true);
  assert.equal(hasSpaceForPrefetch(buffer - 1, 0), false);
  assert.equal(hasSpaceForPrefetch(3 * 1024 * 1024 * 1024, 2 * 1024 * 1024 * 1024), true);
  assert.equal(hasSpaceForPrefetch(1024, 2 * 1024 * 1024 * 1024), false);
});

test("mensagem de espaço insuficiente inclui livre e necessário", () => {
  const message = notEnoughPcSpaceMessage(5 * 1024 * 1024 * 1024, 1 * 1024 * 1024 * 1024);
  assert.match(message, /PC/);
  assert.match(message, /1(\.0)? GB/);
  assert.match(message, /5(\.0)? GB/);
});

test("orderDownloadQueue coloca jogos HD antes dos que passam pelo PC", () => {
  const small = 2 * 1024 * 1024 * 1024;
  const large = FAT32_MAX_FILE_BYTES + 1;
  const items = [
    { id: "pc-big", sizeBytes: large },
    { id: "hd-small", sizeBytes: small },
    { id: "pc-huge", sizeBytes: large + 1 },
    { id: "hd-tiny", sizeBytes: 100 },
  ];

  const sorted = orderDownloadQueue(items, (item) => item.sizeBytes);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["hd-small", "hd-tiny", "pc-big", "pc-huge"],
  );
});

test("maxConcurrentExtracts retorna limites corretos por modo", () => {
  assert.equal(maxConcurrentExtracts("economico"), 1);
  assert.equal(maxConcurrentExtracts("equilibrado"), 2);
  assert.equal(maxConcurrentExtracts("rapido"), 5);
});

test("isValidInstallMode aceita os 3 modos e rejeita o resto", () => {
  assert.equal(isValidInstallMode("economico"), true);
  assert.equal(isValidInstallMode("equilibrado"), true);
  assert.equal(isValidInstallMode("rapido"), true);
  assert.equal(isValidInstallMode("turbo"), false);
  assert.equal(isValidInstallMode(null), false);
  assert.equal(isValidInstallMode(42), false);
});

test("orderDownloadQueue preserva a ordem relativa dentro de cada grupo", () => {
  const hd = 100;
  const pc = FAT32_MAX_FILE_BYTES + 1;
  const items = [
    { id: "hd-first", sizeBytes: hd },
    { id: "pc-first", sizeBytes: pc },
    { id: "hd-second", sizeBytes: hd + 50 },
  ];

  const sorted = orderDownloadQueue(items, (item) => item.sizeBytes);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["hd-first", "hd-second", "pc-first"],
  );
});

test("peakConcurrentBytes soma no máximo N extrações do modo", () => {
  const sizes = [100, 80, 50, 10];
  assert.equal(peakConcurrentBytes(sizes, "economico"), 100);
  assert.equal(peakConcurrentBytes(sizes, "equilibrado"), 180);
  assert.equal(peakConcurrentBytes(sizes, "rapido"), 240);
  const large = FAT32_MAX_FILE_BYTES + 1;
  assert.equal(peakPcStagingBytes([100, large, large], "equilibrado"), large * 2);
  assert.equal(peakPcStagingBytes([100, large], "rapido"), large);
});
