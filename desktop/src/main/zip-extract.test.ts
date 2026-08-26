import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  detectContentRoot,
  findGodTitleFolder,
  resolveExtractRoot,
} from "../src/main/zip-extract.ts";

async function makeGodTree(base: string, titleId: string, inner = "00007000") {
  const titleDir = path.join(
    base,
    "Content",
    "0000000000000000",
    titleId,
    inner,
  );
  await mkdir(titleDir, { recursive: true });
  await writeFile(path.join(titleDir, "game.data"), "payload");
}

test("detectContentRoot desce demais em GOD com pasta 00007000 única", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "montahd-god-test-"));
  try {
    await makeGodTree(temp, "454108A8");
    const naive = await detectContentRoot(temp);
    assert.match(naive.replace(/\\/g, "/"), /454108A8\/00007000$/);

    const resolved = await resolveExtractRoot(
      temp,
      "Content/0000000000000000/454108A8",
    );
    assert.match(resolved.replace(/\\/g, "/"), /454108A8$/);
    assert.doesNotMatch(resolved.replace(/\\/g, "/"), /00007000$/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("findGodTitleFolder encontra Title ID com múltiplas subpastas", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "montahd-god-test-"));
  try {
    const titleDir = path.join(
      temp,
      "Content",
      "0000000000000000",
      "584111F7",
    );
    await mkdir(path.join(titleDir, "00009000"), { recursive: true });
    await mkdir(path.join(titleDir, "000B0000"), { recursive: true });

    const found = await findGodTitleFolder(temp, "584111F7");
    assert.equal(path.basename(found ?? ""), "584111F7");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("resolveExtractRoot mantém Games com wrapper único", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "montahd-god-test-"));
  try {
    const gameDir = path.join(temp, "FIFA 06", "data");
    await mkdir(gameDir, { recursive: true });
    await writeFile(path.join(gameDir, "default.xex"), "xex");

    const resolved = await resolveExtractRoot(temp, "Games/FIFA 06");
    assert.match(resolved.replace(/\\/g, "/"), /FIFA 06\/data$/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
