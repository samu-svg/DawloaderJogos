import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedManifestEntry } from "../shared/manifest.ts";
import { resolveTrustedEntries } from "../shared/trusted-entries.ts";

const HOSTED: ResolvedManifestEntry = {
  id: "entry-1",
  label: "Jogo Um",
  destination: "Games/JogoUm",
  sizeBytes: 1024,
  kind: "hosted",
  sha256: "a".repeat(64),
  downloadUrl: "https://cdn.montahd.app/jogo-um.zip",
};

function trusted(...entries: ResolvedManifestEntry[]) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

test("ignora url, kind e sha256 enviados pelo renderer", () => {
  const { entries, rejected } = resolveTrustedEntries(trusted(HOSTED), [
    {
      id: "entry-1",
      label: "Jogo Um",
      destination: "Games/JogoUm",
      // campos que um renderer adulterado tentaria injetar
      downloadUrl: "https://atacante.example/payload.zip",
      kind: "external",
      sha256: undefined,
    } as never,
  ]);

  assert.equal(rejected.length, 0);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].downloadUrl, HOSTED.downloadUrl);
  assert.equal(entries[0].kind, "hosted");
  assert.equal(entries[0].sha256, HOSTED.sha256);
});

test("recusa item que não está no manifesto carregado", () => {
  const { entries, rejected } = resolveTrustedEntries(trusted(HOSTED), [
    { id: "desconhecido", label: "Inventado", destination: "Games/X" },
  ]);

  assert.equal(entries.length, 0);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].entryId, "desconhecido");
});

test("aceita destino escolhido pelo usuário", () => {
  const { entries } = resolveTrustedEntries(trusted(HOSTED), [
    { id: "entry-1", destination: "Outra/Pasta" },
  ]);

  assert.equal(entries[0].destination, "Outra/Pasta");
  assert.equal(entries[0].downloadUrl, HOSTED.downloadUrl);
});

test("usa o destino do manifesto quando o renderer manda vazio", () => {
  const { entries } = resolveTrustedEntries(trusted(HOSTED), [
    { id: "entry-1", destination: "   " },
  ]);

  assert.equal(entries[0].destination, HOSTED.destination);
});

test("não baixa o mesmo item duas vezes", () => {
  const { entries } = resolveTrustedEntries(trusted(HOSTED), [
    { id: "entry-1", destination: "Games/JogoUm" },
    { id: "entry-1", destination: "Games/Copia" },
  ]);

  assert.equal(entries.length, 1);
});

test("manifesto ainda não carregado recusa tudo", () => {
  const { entries, rejected } = resolveTrustedEntries(new Map(), [
    { id: "entry-1", destination: "Games/JogoUm" },
  ]);

  assert.equal(entries.length, 0);
  assert.equal(rejected.length, 1);
});
