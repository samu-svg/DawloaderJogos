import assert from "node:assert/strict";
import test from "node:test";
import { FAT32_MAX_FILE_BYTES, orderDownloadQueue } from "../shared/pc-space.ts";
import { orderPriorityRootInstallFirst } from "../shared/special-downloads.ts";

/** Mesma composição de sortPipelineEntries, sem importar o módulo da fila. */
function sortLikePipeline(items: { id: string; sizeBytes: number }[]) {
  const ordered = orderDownloadQueue(items, (item) => item.sizeBytes);
  return orderPriorityRootInstallFirst(ordered, (item) => item.id);
}

test("fila coloca AbadAvatar na frente dos jogos HD e PC", () => {
  const sorted = sortLikePipeline([
    { id: "pc-big", sizeBytes: FAT32_MAX_FILE_BYTES + 1 },
    { id: "hd-game", sizeBytes: 100 },
    { id: "abadavatar", sizeBytes: 200 },
    { id: "hd-other", sizeBytes: 50 },
  ]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["abadavatar", "hd-game", "hd-other", "pc-big"],
  );
});
