import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  recoverInterruptedDestSwap,
  withDestSwap,
  withRootSwap,
} from "./install-swap.ts";

async function tempHd(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "montahd-swap-"));
}

test("falha na cópia devolve a pasta antiga", async () => {
  const hd = await tempHd();
  try {
    const dest = path.join(hd, "Games", "Halo");
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, "save.txt"), "antigo");

    await assert.rejects(
      () =>
        withDestSwap(hd, "halo", dest, async () => {
          await mkdir(dest, { recursive: true });
          await writeFile(path.join(dest, "novo.txt"), "parcial");
          throw new Error("disco cheio");
        }),
      /disco cheio/,
    );

    assert.equal(await readFile(path.join(dest, "save.txt"), "utf8"), "antigo");
    assert.equal(existsSync(path.join(dest, "novo.txt")), false);
  } finally {
    await rm(hd, { recursive: true, force: true });
  }
});

test("sucesso na troca apaga o outgoing e deixa só o novo", async () => {
  const hd = await tempHd();
  try {
    const dest = path.join(hd, "Games", "Halo");
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, "save.txt"), "antigo");

    await withDestSwap(hd, "halo", dest, async () => {
      await mkdir(dest, { recursive: true });
      await writeFile(path.join(dest, "novo.txt"), "ok");
      return dest;
    });

    assert.equal(await readFile(path.join(dest, "novo.txt"), "utf8"), "ok");
    assert.equal(existsSync(path.join(dest, "save.txt")), false);
    assert.equal(existsSync(path.join(hd, ".montahd", "outgoing", "halo")), false);
  } finally {
    await rm(hd, { recursive: true, force: true });
  }
});

test("primeira instalação não inventa pasta antiga", async () => {
  const hd = await tempHd();
  try {
    const dest = path.join(hd, "Games", "Novo");
    await withDestSwap(hd, "novo", dest, async () => {
      await mkdir(dest, { recursive: true });
      await writeFile(path.join(dest, "ok.txt"), "sim");
      return dest;
    });
    assert.equal(await readFile(path.join(dest, "ok.txt"), "utf8"), "sim");
  } finally {
    await rm(hd, { recursive: true, force: true });
  }
});

test("troca interrompida com pasta nova pela metade devolve o antigo", async () => {
  const hd = await tempHd();
  try {
    const dest = path.join(hd, "Games", "Halo");
    const held = path.join(hd, ".montahd", "outgoing", "halo", "payload");
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, "novo.txt"), "pela metade");
    await mkdir(held, { recursive: true });
    await writeFile(path.join(held, "save.txt"), "antigo");

    await recoverInterruptedDestSwap(hd, "halo", dest);
    assert.equal(await readFile(path.join(dest, "save.txt"), "utf8"), "antigo");
    assert.equal(existsSync(path.join(dest, "novo.txt")), false);
    assert.equal(existsSync(held), false);
  } finally {
    await rm(hd, { recursive: true, force: true });
  }
});

test("troca interrompida devolve o destino se o novo não chegou", async () => {
  const hd = await tempHd();
  try {
    const dest = path.join(hd, "Games", "Halo");
    const held = path.join(hd, ".montahd", "outgoing", "halo", "payload");
    await mkdir(held, { recursive: true });
    await writeFile(path.join(held, "save.txt"), "antigo");

    await recoverInterruptedDestSwap(hd, "halo", dest);
    assert.equal(await readFile(path.join(dest, "save.txt"), "utf8"), "antigo");
    assert.equal(existsSync(held), false);
  } finally {
    await rm(hd, { recursive: true, force: true });
  }
});

test("falha na raiz devolve o marcador antigo", async () => {
  const hd = await tempHd();
  try {
    const marker = path.join(hd, "AbadAvatar");
    await mkdir(marker, { recursive: true });
    await writeFile(path.join(marker, "old.bin"), "keep");

    await assert.rejects(
      () =>
        withRootSwap(hd, "abadavatar", ["AbadAvatar"], async () => {
          await mkdir(marker, { recursive: true });
          await writeFile(path.join(marker, "new.bin"), "partial");
          throw new Error("copia falhou");
        }),
      /copia falhou/,
    );

    assert.equal(await readFile(path.join(marker, "old.bin"), "utf8"), "keep");
    assert.equal(existsSync(path.join(marker, "new.bin")), false);
  } finally {
    await rm(hd, { recursive: true, force: true });
  }
});
