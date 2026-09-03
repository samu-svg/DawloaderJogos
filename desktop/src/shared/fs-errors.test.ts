import assert from "node:assert/strict";
import test from "node:test";
import { formatFsError, isHdDisconnectError } from "./fs-errors.ts";

test("ENOSPC menciona HD até 4 GB e PC acima por causa do FAT32", () => {
  const error = Object.assign(new Error("ENOSPC: no space left on device"), { code: "ENOSPC" });
  const message = formatFsError(error);
  assert.match(message, /4 GB/);
  assert.match(message, /FAT32/);
  assert.match(message, /HD/);
  assert.match(message, /PC/);
});

test("isHdDisconnectError cobre USB arrancado e unidade inacessível", () => {
  const missing = Object.assign(new Error("ENOENT: no such file or directory, open 'E:\\\\a.zip'"), {
    code: "ENOENT",
  });
  const unknown = Object.assign(new Error("UNKNOWN: unknown error, write"), { code: "UNKNOWN" });
  assert.equal(isHdDisconnectError(missing), true);
  assert.equal(isHdDisconnectError(unknown), true);
  assert.equal(isHdDisconnectError(new Error("The device is not ready.")), true);
  assert.equal(isHdDisconnectError(new Error("Download falhou (404).")), false);
  assert.match(formatFsError(missing), /retoma o download sozinho/i);
});

test("EPERM mkdir na raiz do disco pede a versão nova do app", () => {
  const error = Object.assign(new Error("EPERM: operation not permitted, mkdir 'D:\\'"), {
    code: "EPERM",
  });
  const message = formatFsError(error);
  assert.match(message, /raiz do disco/i);
  assert.match(message, /site/i);
});
