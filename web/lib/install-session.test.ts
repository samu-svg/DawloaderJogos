import test from "node:test";
import assert from "node:assert/strict";
import {
  createInstallSessionToken,
  verifyInstallSessionToken,
} from "./install-session.ts";

test("sessao de instalacao assina e valida payload", () => {
  process.env.MANIFEST_TOKEN_SECRET = "test-secret";

  const token = createInstallSessionToken({
    userId: "user-1",
    slug: "jogos360",
    entryIds: ["a", "b"],
    ttlSeconds: 600,
  });

  assert.ok(token);
  const payload = verifyInstallSessionToken(token!);
  assert.ok(payload);
  assert.equal(payload.sub, "user-1");
  assert.equal(payload.slug, "jogos360");
  assert.deepEqual(payload.entries, ["a", "b"]);
});

test("rejeita sessao com assinatura invalida", () => {
  process.env.MANIFEST_TOKEN_SECRET = "test-secret";

  const token = createInstallSessionToken({
    userId: "user-1",
    slug: "jogos360",
  });

  assert.ok(token);
  const tampered = `${token!.slice(0, -1)}x`;
  assert.equal(verifyInstallSessionToken(tampered), null);
});
