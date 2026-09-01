import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMontaHDCatalogLink,
  parseMontaHDEntryIds,
} from "./montahd-link.ts";

test("monta link profundo no formato install/slug (sem & na query)", () => {
  const link = buildMontaHDCatalogLink(
    "https://montahd.vercel.app/",
    "jogos360",
  );
  assert.equal(link, "montahd://install/jogos360");
  assert.doesNotMatch(link, /&/);
});

test("inclui sessao de instalacao no path do link profundo", () => {
  const link = buildMontaHDCatalogLink(
    "https://montahd.vercel.app",
    "jogos360",
    ["abc-123", "def-456"],
    { installSession: "sess.abc-xyz" },
  );
  assert.equal(link, "montahd://install/jogos360/sess.abc-xyz");
  assert.doesNotMatch(link, /&/);
  assert.doesNotMatch(link, /entries=/);
});

test("inclui ids na url quando nao ha sessao", () => {
  const link = buildMontaHDCatalogLink(
    "https://montahd.vercel.app",
    "jogos360",
    ["abc-123", "def-456"],
  );
  assert.equal(
    link,
    "montahd://install/jogos360?entries=abc-123%2Cdef-456",
  );
  assert.doesNotMatch(link, /session=/);
  assert.doesNotMatch(link, /token=/);
});

test("nunca coloca token HMAC na query do deep link", () => {
  const link = buildMontaHDCatalogLink(
    "https://montahd.vercel.app",
    "jogos360",
    ["abc"],
    { installSession: null },
  );
  assert.doesNotMatch(link, /token=/);
});

test("parseia ids do parametro entries", () => {
  assert.deepEqual(parseMontaHDEntryIds("a,b, c"), ["a", "b", "c"]);
  assert.deepEqual(parseMontaHDEntryIds(""), []);
});
