import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, link, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { crc32 } from "node:zlib";
import {
  assertNoSymlinks,
  assertZipEntryPath,
  detectContentRoot,
  extractZipToContentRoot,
  findGodTitleFolder,
  isZipSymlinkEntry,
  resolveExtractRoot,
} from "./zip-extract.ts";

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

test("assertZipEntryPath rejeita zip-slip e caminhos absolutos", () => {
  const root = path.resolve("/tmp/montahd-extract-root");
  assert.equal(
    assertZipEntryPath(root, "Games/FIFA/default.xex"),
    path.resolve(root, "Games/FIFA/default.xex"),
  );
  assert.throws(() => assertZipEntryPath(root, "../evil.txt"), /fora da pasta/);
  assert.throws(() => assertZipEntryPath(root, "Games/../../etc/passwd"), /fora da pasta/);
  assert.throws(() => assertZipEntryPath(root, "/etc/passwd"), /absoluto/);
  assert.throws(() => assertZipEntryPath(root, "C:/Windows/System32/a.dll"), /absoluto/);
});

test("assertZipEntryPath rejeita barra invertida no Windows", () => {
  const root = path.resolve("/tmp/montahd-extract-root");
  assert.throws(
    () => assertZipEntryPath(root, "Games\\..\\..\\evil.txt"),
    /fora da pasta/,
  );
  assert.throws(() => assertZipEntryPath(root, "..\\evil.txt"), /fora da pasta/);
});

test("isZipSymlinkEntry detecta modo Unix symlink", () => {
  assert.equal(
    isZipSymlinkEntry({
      fileName: "link",
      versionMadeBy: 3 << 8,
      externalFileAttributes: 0o120777 << 16,
    }),
    true,
  );
  assert.equal(
    isZipSymlinkEntry({
      fileName: "file.txt",
      versionMadeBy: 3 << 8,
      externalFileAttributes: 0o100644 << 16,
    }),
    false,
  );
});

test("assertNoSymlinks recusa atalho na árvore extraída", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "montahd-symlink-test-"));
  try {
    const target = path.join(temp, "real.txt");
    await writeFile(target, "ok");
    await symlink(target, path.join(temp, "alias"));
    await assert.rejects(() => assertNoSymlinks(temp), /symlink|link/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("assertNoSymlinks recusa hardlink para arquivo fora da pasta", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "montahd-hardlink-test-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "montahd-outside-"));
  try {
    const target = path.join(outside, "secret.txt");
    await writeFile(target, "secret");
    try {
      await link(target, path.join(temp, "hardlink.txt"));
      await assert.rejects(() => assertNoSymlinks(temp), /hardlink/);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "ENOTSUP" || code === "EXDEV") {
        return;
      }
      throw error;
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

function makeStoredZip(files: { name: string; data: string }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.data);
    const crc = crc32(data) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const localPart = Buffer.concat([local, name, data]);
    locals.push(localPart);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));
    offset += localPart.length;
  }

  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, end]);
}

test("extractZipToContentRoot extrai zip legítimo", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "montahd-zip-ok-"));
  try {
    const zipPath = path.join(temp, "ok.zip");
    await writeFile(zipPath, makeStoredZip([{ name: "jogo/default.xex", data: "xex" }]));
    const extracted = await extractZipToContentRoot(zipPath);
    try {
      const payload = await readFile(path.join(extracted.contentRoot, "default.xex"), "utf8");
      assert.equal(payload, "xex");
    } finally {
      await rm(extracted.tempDir, { recursive: true, force: true });
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("extractZipToContentRoot recusa zip-slip", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "montahd-zip-slip-"));
  try {
    const zipPath = path.join(temp, "evil.zip");
    await writeFile(zipPath, makeStoredZip([{ name: "../evil.txt", data: "pwned" }]));
    await assert.rejects(() => extractZipToContentRoot(zipPath), /fora da pasta/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("extractZipToContentRoot recusa zip-slip com barra invertida", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "montahd-zip-slip-bs-"));
  try {
    const zipPath = path.join(temp, "evil.zip");
    await writeFile(
      zipPath,
      makeStoredZip([{ name: "..\\evil.txt", data: "pwned" }]),
    );
    await assert.rejects(() => extractZipToContentRoot(zipPath), /fora da pasta/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
