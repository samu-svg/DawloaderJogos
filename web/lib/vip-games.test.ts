import assert from "node:assert/strict";
import test from "node:test";
import { isVipGame } from "./vip-games.ts";

test("jogo dublado é VIP", () => {
  assert.equal(
    isVipGame({
      id: "any",
      label: "Halo 3",
      audio: "dublado",
    }),
    true,
  );
});

test("GTA V é VIP mesmo sem dublagem confirmada", () => {
  assert.equal(
    isVipGame({
      id: "00000000-0000-4000-8000-000000000001",
      label: "Grand Theft Auto V",
    }),
    true,
  );
});

test("GTA San Andreas sem dublagem no metadado não é VIP", () => {
  assert.equal(
    isVipGame({
      id: "00000000-0000-4000-8000-000000000002",
      label: "Grand Theft Auto: San Andreas",
      displayTitle: "GTA: San Andreas",
      audio: "pt-br",
    }),
    false,
  );
});

test("jogo comum sem dublagem não é VIP", () => {
  assert.equal(
    isVipGame({
      id: "00000000-0000-4000-8000-000000000003",
      label: "Halo 3",
      audio: "ingles",
    }),
    false,
  );
});

test("rótulo com dublado no nome também é VIP", () => {
  assert.equal(
    isVipGame({
      id: "any",
      label: "Need for Speed Rivals - Dublado",
    }),
    true,
  );
});
