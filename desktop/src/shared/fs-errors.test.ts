import assert from "node:assert/strict";
import test from "node:test";
import { formatFsError } from "./fs-errors.ts";

test("ENOSPC menciona HD até 4 GB e PC acima por causa do FAT32", () => {
  const error = Object.assign(new Error("ENOSPC: no space left on device"), { code: "ENOSPC" });
  const message = formatFsError(error);
  assert.match(message, /4 GB/);
  assert.match(message, /FAT32/);
  assert.match(message, /HD/);
  assert.match(message, /PC/);
});

test("EPERM mkdir na raiz do disco pede a versão nova do app", () => {
  const error = Object.assign(new Error("EPERM: operation not permitted, mkdir 'D:\\'"), {
    code: "EPERM",
  });
  const message = formatFsError(error);
  assert.match(message, /raiz do disco/i);
  assert.match(message, /site/i);
});
