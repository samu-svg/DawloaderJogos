import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isPathUnderRoot } from "../shared/path-safety.ts";
import { validateDestination } from "../shared/manifest.ts";

function resolveUnderRoot(
  rootDir: string,
  destination: string,
): { ok: true; fullPath: string } | { ok: false; error: string } {
  const validated = validateDestination(destination);
  if (!validated.ok) return validated;

  const fullPath = path.resolve(rootDir, ...validated.destination.split("/"));
  if (!isPathUnderRoot(rootDir, fullPath)) {
    return { ok: false, error: "O destino tenta sair da pasta raiz escolhida." };
  }

  return { ok: true, fullPath };
}

test("resolveUnderRoot bloqueia path traversal", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "montahd-root-"));
  try {
    const ok = resolveUnderRoot(root, "Games/FIFA 06");
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.ok(isPathUnderRoot(root, ok.fullPath));
    }

    const bad = resolveUnderRoot(root, "Games/../../etc");
    assert.equal(bad.ok, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("isPathUnderRoot rejeita caminho fora da raiz", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "montahd-root-"));
  try {
    const sibling = await mkdtemp(path.join(os.tmpdir(), "montahd-sibling-"));
    try {
      assert.equal(isPathUnderRoot(root, path.join(root, "Games", "foo")), true);
      assert.equal(isPathUnderRoot(root, sibling), false);
      assert.equal(isPathUnderRoot(root, path.join(root, "..")), false);
    } finally {
      await rm(sibling, { recursive: true, force: true });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
