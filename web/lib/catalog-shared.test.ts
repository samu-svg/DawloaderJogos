import assert from "node:assert/strict";
import { test } from "node:test";
import { entriesBelongToSingleGame } from "./catalog-shared.ts";

const games = [
  { id: "g1", entryIds: ["a", "a-dlc"] },
  { id: "g2", entryIds: ["b"] },
];

test("um jogo com extras continua um único jogo", () => {
  assert.equal(entriesBelongToSingleGame(games, ["a", "a-dlc"]), true);
  assert.equal(entriesBelongToSingleGame(games, ["a"]), true);
});

test("misturar dois jogos é recusado", () => {
  assert.equal(entriesBelongToSingleGame(games, ["a", "b"]), false);
});

test("lista vazia ou id desconhecido é recusado", () => {
  assert.equal(entriesBelongToSingleGame(games, []), false);
  assert.equal(entriesBelongToSingleGame(games, ["zzz"]), false);
});
