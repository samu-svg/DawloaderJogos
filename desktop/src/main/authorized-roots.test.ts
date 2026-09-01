import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  assertAuthorizedRoot,
  rememberAuthorizedRoot,
  resetAuthorizedRootsForTests,
} from "./authorized-roots.ts";

test("recusa rootDir que não passou pelo diálogo do app", () => {
  resetAuthorizedRootsForTests();
  assert.throws(() => assertAuthorizedRoot("C:\\Users\\Public"), /Escolha a pasta/);
});

test("aceita a pasta escolhida no diálogo, independente de maiúsculas", () => {
  resetAuthorizedRootsForTests();
  const chosen = rememberAuthorizedRoot("C:\\Games\\HD");
  assert.equal(assertAuthorizedRoot("C:\\Games\\HD"), path.resolve("C:\\Games\\HD"));
  assert.equal(assertAuthorizedRoot("c:\\games\\hd"), path.resolve("c:\\games\\hd"));
  assert.ok(chosen);
});
