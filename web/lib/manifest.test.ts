import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findDuplicateDestinations,
  normalizeManifestSha256,
  omitDownloadUrls,
  validateDestination,
} from "./manifest.ts";

test("aceita caminhos relativos comuns", () => {
  for (const input of [
    "Games",
    "Games/MeuArquivo.iso",
    "Content/0000000000000000/pasta/arquivo.bin",
    "Games/Sub Pasta/arquivo com espaço.iso",
  ]) {
    const result = validateDestination(input);
    assert.equal(result.ok, true, `deveria aceitar ${input}`);
  }
});

test("normaliza barras invertidas e barra final", () => {
  assert.deepEqual(validateDestination("Games\\Sub\\a.iso"), {
    ok: true,
    destination: "Games/Sub/a.iso",
  });
  assert.deepEqual(validateDestination("  Games/Sub/  "), {
    ok: true,
    destination: "Games/Sub",
  });
});

test("rejeita fuga da pasta raiz", () => {
  for (const input of [
    "../fora.txt",
    "Games/../../fora.txt",
    "Games/./a.iso",
    "/etc/passwd",
    "\\Windows\\System32\\a.dll",
    "C:/Windows/System32/a.dll",
    "c:a.dll",
    "//servidor/share/a.dll",
  ]) {
    const result = validateDestination(input);
    assert.equal(result.ok, false, `deveria rejeitar ${input}`);
  }
});

test("rejeita nomes que o Windows não cria", () => {
  for (const input of [
    "Games/CON",
    "Games/nul.txt",
    "Games/LPT1/a.iso",
    "Games/pasta./a.iso",
    "Games/pasta /a.iso",
    'Games/a"b',
    "Games/a|b",
    "Games/a\u0000b",
  ]) {
    const result = validateDestination(input);
    assert.equal(result.ok, false, `deveria rejeitar ${input}`);
  }
});

test("rejeita vazio, profundidade e comprimento excessivos", () => {
  assert.equal(validateDestination("   ").ok, false);
  assert.equal(validateDestination("a/".repeat(13) + "f.iso").ok, false);
  assert.equal(validateDestination("a".repeat(201)).ok, false);
});

test("aponta destinos duplicados sem diferenciar maiúsculas", () => {
  const duplicates = findDuplicateDestinations([
    { id: "1", label: "a", destination: "Games/a.iso", sizeBytes: 1 },
    { id: "2", label: "b", destination: "games/A.ISO", sizeBytes: 1 },
    { id: "3", label: "c", destination: "Games/c.iso", sizeBytes: 1 },
  ]);
  assert.deepEqual(duplicates, ["games/A.ISO"]);
});

test("normalizeManifestSha256 só aceita SHA-256 hex de 64 chars", () => {
  const hash = "b".repeat(64);
  assert.equal(normalizeManifestSha256(` ${hash.toUpperCase()} `), hash);
  assert.equal(normalizeManifestSha256(null), undefined);
  assert.equal(normalizeManifestSha256("not-a-hash"), undefined);
});

test("omitDownloadUrls tira a URL e deixa o restante intacto", () => {
  const preview = omitDownloadUrls([
    {
      id: "1",
      label: "Jogo",
      destination: "Games/Jogo",
      sizeBytes: 10,
      kind: "hosted",
      sha256: "a".repeat(64),
      downloadUrl: "https://cdn.example/secret.zip?sig=abc",
    },
  ]);
  assert.equal(preview.length, 1);
  assert.equal("downloadUrl" in preview[0], false);
  assert.equal(preview[0].id, "1");
  assert.equal(preview[0].destination, "Games/Jogo");
  assert.equal(JSON.stringify(preview).includes("secret.zip"), false);
});
