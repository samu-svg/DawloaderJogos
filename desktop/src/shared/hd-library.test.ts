import test from "node:test";
import assert from "node:assert/strict";
import {
  destinationKey,
  destinationsRelated,
  displayNameFromPath,
  emptyParentsToRemove,
  folderDetailFromPath,
  inferGroup,
  installedDestinationFromManifest,
  isCodeOnlyDisplayName,
  deleteTargetFromManifest,
  matchHint,
  mergeHdLibrary,
  resolveScanLabel,
  titleIdFromDestination,
  removeInstalled,
  shouldTreatAsInstallUnit,
  upsertInstalled,
  upsertLabel,
  validateDeleteDestination,
  emptyHdIndex,
} from "./hd-library.ts";

test("zip vira pasta instalada sem a extensao", () => {
  assert.equal(
    installedDestinationFromManifest("Content/4D5307E6/Mapa.zip"),
    "Content/4D5307E6/Mapa",
  );
  assert.equal(
    deleteTargetFromManifest("Games/Halo.zip"),
    "Games/Halo",
  );
  assert.equal(
    deleteTargetFromManifest("Pack -AbadAvatar V1.3 + AutoStart Imediato.rar"),
    "Pack -AbadAvatar V1.3 + AutoStart Imediato.rar",
  );
});

test("validateDeleteDestination bloqueia pastas raiz", () => {
  assert.equal(validateDeleteDestination("Games").ok, false);
  assert.equal(validateDeleteDestination("Content").ok, false);
  assert.equal(validateDeleteDestination("Outro/Jogo").ok, false);
  assert.equal(validateDeleteDestination("Games/Halo").ok, true);
  assert.equal(validateDeleteDestination("Content/4D5307E6/dlc").ok, true);
  assert.equal(validateDeleteDestination("AbadAvatar").ok, true);
  assert.equal(
    validateDeleteDestination("Pack -AbadAvatar V1.3 + AutoStart Imediato.rar").ok,
    true,
  );
});

test("emptyParentsToRemove nunca inclui Games ou Content", () => {
  assert.deepEqual(emptyParentsToRemove("Games/Halo"), []);
  assert.deepEqual(emptyParentsToRemove("Content/AAAA/dlc"), ["Content/AAAA"]);
  assert.deepEqual(emptyParentsToRemove("Content/A/B/C"), [
    "Content/A/B",
    "Content/A",
  ]);
});

test("displayNameFromPath prefere nome legivel ao title id", () => {
  assert.equal(displayNameFromPath("Content/4D5307E6/MapPack"), "MapPack");
  assert.equal(displayNameFromPath("Content/4D5307E6"), "DLC 4D5307E6");
  assert.equal(
    displayNameFromPath("Content/0000000000000000/41560855"),
    "DLC 41560855",
  );
  assert.equal(displayNameFromPath("Games/Halo 3"), "Halo 3");
  assert.equal(isCodeOnlyDisplayName("DLC 4D5307E6"), true);
  assert.equal(isCodeOnlyDisplayName("MapPack"), false);
  assert.equal(titleIdFromDestination("Content/0000000000000000/415608FC"), "415608FC");
  assert.equal(folderDetailFromPath("Content/4D5307E6/MapPack"), "MapPack");
});

test("resolveScanLabel usa Title ID para nome do jogo", () => {
  const titleIds = { "4D5307E6": "Halo 3", "415608FC": "Call of Duty: Ghosts" };
  const pack = resolveScanLabel("Content/4D5307E6/MapPack", titleIds);
  assert.equal(pack.label, "Halo 3 — MapPack");
  assert.equal(pack.knownName, true);
  assert.equal(pack.gameName, "Halo 3");

  const god = resolveScanLabel("Content/0000000000000000/415608FC", titleIds);
  assert.equal(god.label, "Call of Duty: Ghosts");
  assert.equal(god.knownName, true);

  const unknown = resolveScanLabel("Content/AAAAAAAA", {});
  assert.equal(unknown.label, "DLC AAAAAAAA");
  assert.equal(unknown.knownName, false);
});

test("matchHint aceita destino com zip e prefixo", () => {
  const hints = [
    { label: "Map Pack", destination: "Content/4D5307E6/dlc1.zip", group: "conteudo" },
  ];
  assert.equal(matchHint("Content/4D5307E6/dlc1", hints)?.label, "Map Pack");
  assert.equal(matchHint("Content/4D5307E6/dlc1/inner", hints)?.label, "Map Pack");
  assert.equal(matchHint("Content/FFFFFFFF/outro", hints), null);
});

test("shouldTreatAsInstallUnit desce pastas que so tem subpastas", () => {
  assert.equal(shouldTreatAsInstallUnit("Content", [{ isDirectory: true }], 0), false);
  assert.equal(
    shouldTreatAsInstallUnit("Content/4D5307E6", [{ isDirectory: false }], 1),
    true,
  );
  assert.equal(
    shouldTreatAsInstallUnit(
      "Content/0000000000000000",
      [{ isDirectory: true }, { isDirectory: true }],
      1,
    ),
    false,
  );
  assert.equal(
    shouldTreatAsInstallUnit("Content/A/B/C", [{ isDirectory: true }], 3),
    true,
  );
});

test("mergeHdLibrary usa indice, depois dica do catalogo", () => {
  const items = mergeHdLibrary({
    scanned: [
      { destination: "Games/Halo", sizeBytes: 100 },
      { destination: "Content/4D5307E6/dlc1", sizeBytes: 50 },
      { destination: "Content/AAAAAAAA", sizeBytes: 10 },
    ],
    index: [
      {
        id: "halo",
        label: "Halo 3",
        destination: "Games/Halo",
        group: "jogo",
        installedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    hints: [
      { label: "Map Pack", destination: "Content/4D5307E6/dlc1.zip", group: "conteudo" },
    ],
  });

  assert.equal(items.length, 3);
  const halo = items.find((item) => item.id === "halo");
  const dlc = items.find((item) => item.label === "Map Pack");
  const coded = items.find((item) => item.destination === "Content/AAAAAAAA");
  assert.equal(halo?.knownName, true);
  assert.equal(halo?.source, "index");
  assert.equal(dlc?.knownName, true);
  assert.equal(dlc?.source, "scan");
  assert.equal(coded?.knownName, false);
  assert.equal(coded?.label, "DLC AAAAAAAA");
  assert.equal(inferGroup("Content/AAAAAAAA"), "conteudo");
  assert.equal(inferGroup("AbadAvatar"), "utilitario");

  const namedFolder = mergeHdLibrary({
    scanned: [{ destination: "Content/4D5307E6/MapPack", sizeBytes: 1 }],
    index: [],
    hints: [],
  });
  assert.equal(namedFolder[0]?.label, "MapPack");
  assert.equal(namedFolder[0]?.knownName, true);

  const byTitleId = mergeHdLibrary({
    scanned: [
      { destination: "Content/4D5307E6", sizeBytes: 10 },
      { destination: "Content/4D5307E6/MapPack", sizeBytes: 1 },
    ],
    index: [],
    hints: [],
    titleIds: { "4D5307E6": "Halo 3" },
  });
  assert.equal(byTitleId[0]?.gameName, "Halo 3");
  assert.equal(byTitleId[0]?.knownName, true);
  assert.ok(byTitleId.some((item) => item.label === "Halo 3"));
  assert.ok(byTitleId.some((item) => item.label === "Halo 3 — MapPack"));
});

test("destinationsRelated ignora extensao e barra invertida", () => {
  assert.equal(
    destinationsRelated("Content\\ID\\foo.zip", "Content/ID/foo"),
    true,
  );
  assert.equal(destinationKey("Games/A.ZIP"), "games/a");
});

test("upsert e remove do indice", () => {
  let index = emptyHdIndex();
  index = upsertInstalled(index, {
    id: "1",
    label: "Halo",
    destination: "Games/Halo.zip",
    group: "jogo",
    installedAt: "2026-01-01T00:00:00.000Z",
  });
  index = upsertLabel(index, {
    label: "Map Pack",
    destination: "Content/ID/dlc.zip",
  });
  assert.equal(index.items[0].destination, "Games/Halo");
  assert.equal(index.labels.length, 2);

  index = removeInstalled(index, "Games/Halo");
  assert.equal(index.items.length, 0);
});
