import assert from "node:assert/strict";
import test from "node:test";
import { detectWindowsBuildId, isWindowsBuildId } from "./windows-build.ts";

test("detecta Windows 10/11 64-bit", () => {
  assert.equal(
    detectWindowsBuildId(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ),
    "win10-x64",
  );
});

test("WOW64 recomenda a build 64-bit", () => {
  assert.equal(
    detectWindowsBuildId(
      "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36",
    ),
    "win10-x64",
  );
});

test("detecta Windows 10 32-bit", () => {
  assert.equal(
    detectWindowsBuildId("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36"),
    "win10-ia32",
  );
});

test("detecta Windows 7 64-bit", () => {
  assert.equal(
    detectWindowsBuildId(
      "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36",
    ),
    "win7-x64",
  );
});

test("detecta Windows 8.1 32-bit", () => {
  assert.equal(
    detectWindowsBuildId("Mozilla/5.0 (Windows NT 6.3) AppleWebKit/537.36"),
    "win7-ia32",
  );
});

test("isWindowsBuildId valida ids conhecidos", () => {
  assert.equal(isWindowsBuildId("win10-x64"), true);
  assert.equal(isWindowsBuildId("invalid"), false);
});
