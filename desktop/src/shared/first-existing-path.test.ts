import test from "node:test";
import assert from "node:assert/strict";
import { firstExistingPath } from "./first-existing-path.ts";

test("firstExistingPath devolve o primeiro que existe", () => {
  assert.equal(firstExistingPath(["C:\\no-such-montahd-a", process.execPath]), process.execPath);
});

test("firstExistingPath cai no primeiro se nenhum existe", () => {
  assert.equal(firstExistingPath(["C:\\no-such-montahd-a", "C:\\no-such-montahd-b"]), "C:\\no-such-montahd-a");
});
