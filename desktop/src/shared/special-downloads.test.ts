import assert from "node:assert/strict";
import test from "node:test";
import {
  destinationForPriorityRootInstall,
  isPriorityRootInstall,
  orderPriorityRootInstallFirst,
  rootInstallFileName,
} from "./special-downloads.ts";

test("isPriorityRootInstall reconhece o AbadAvatar", () => {
  assert.equal(isPriorityRootInstall("abadavatar"), true);
  assert.equal(isPriorityRootInstall("halo"), false);
});

test("rootInstallFileName tira Games/ e Content/", () => {
  assert.equal(
    rootInstallFileName("Games/Pack -AbadAvatar V1.3 + AutoStart Imediato.rar"),
    "Pack -AbadAvatar V1.3 + AutoStart Imediato.rar",
  );
  assert.equal(
    rootInstallFileName("Content/AbadAvatar.rar"),
    "AbadAvatar.rar",
  );
  assert.equal(
    rootInstallFileName("Pack -AbadAvatar V1.3 + AutoStart Imediato.rar"),
    "Pack -AbadAvatar V1.3 + AutoStart Imediato.rar",
  );
});

test("destinationForPriorityRootInstall só força raiz no AbadAvatar", () => {
  assert.equal(
    destinationForPriorityRootInstall("abadavatar", "Games/Pack.rar"),
    "Pack.rar",
  );
  assert.equal(
    destinationForPriorityRootInstall("halo", "Games/Halo"),
    "Games/Halo",
  );
});

test("orderPriorityRootInstallFirst coloca AbadAvatar na frente", () => {
  const items = [
    { id: "jogo-hd", size: 100 },
    { id: "jogo-pc", size: 9 },
    { id: "abadavatar", size: 50 },
    { id: "dlc", size: 10 },
  ];
  const ordered = orderPriorityRootInstallFirst(items, (item) => item.id);
  assert.deepEqual(
    ordered.map((item) => item.id),
    ["abadavatar", "jogo-hd", "jogo-pc", "dlc"],
  );
});
