import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyInstallPresence,
  installDirForDestPath,
} from "./install-state.ts";

test("installDirForDestPath tira .zip do destino", () => {
  assert.equal(installDirForDestPath("D:\\HD\\Games\\Halo.zip"), "D:\\HD\\Games\\Halo");
  assert.equal(installDirForDestPath("D:\\HD\\Games\\Halo"), "D:\\HD\\Games\\Halo");
});

test("jogo no indice com pasta no HD e instalado", () => {
  assert.deepEqual(
    classifyInstallPresence({
      destExists: true,
      destFileExists: false,
      hdPartialExists: false,
      stagingPartialExists: false,
      indexed: true,
    }),
    { kind: "installed", canResume: false },
  );
});

test("jogo instalado ignora residual .partial", () => {
  assert.deepEqual(
    classifyInstallPresence({
      destExists: true,
      destFileExists: false,
      hdPartialExists: true,
      stagingPartialExists: false,
      indexed: true,
    }),
    { kind: "installed", canResume: false },
  );
});

test("download incompleto no HD pode retomar", () => {
  assert.deepEqual(
    classifyInstallPresence({
      destExists: false,
      destFileExists: false,
      hdPartialExists: true,
      stagingPartialExists: false,
      indexed: false,
    }),
    { kind: "incomplete", canResume: true },
  );
});

test("download incompleto no PC pode retomar", () => {
  assert.deepEqual(
    classifyInstallPresence({
      destExists: false,
      destFileExists: false,
      hdPartialExists: false,
      stagingPartialExists: true,
      indexed: false,
    }),
    { kind: "incomplete", canResume: true },
  );
});

test("pasta pela metade sem indice nao retoma — apagar e reinstalar", () => {
  assert.deepEqual(
    classifyInstallPresence({
      destExists: true,
      destFileExists: false,
      hdPartialExists: false,
      stagingPartialExists: false,
      indexed: false,
    }),
    { kind: "incomplete", canResume: false },
  );
});

test("zip leftover + pasta extraida nao retoma", () => {
  assert.deepEqual(
    classifyInstallPresence({
      destExists: true,
      destFileExists: true,
      hdPartialExists: true,
      stagingPartialExists: false,
      indexed: false,
    }),
    { kind: "incomplete", canResume: false },
  );
});

test("nada no disco e limpo", () => {
  assert.deepEqual(
    classifyInstallPresence({
      destExists: false,
      destFileExists: false,
      hdPartialExists: false,
      stagingPartialExists: false,
      indexed: false,
    }),
    { kind: "clean", canResume: false },
  );
});
