import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMontaHDCatalogLink,
  parseMontaHDEntryIds,
} from "./montahd-link.ts";

test("monta link profundo com url e slug", () => {
  const link = buildMontaHDCatalogLink(
    "https://montahd.vercel.app/",
    "jogos360",
  );
  assert.equal(
    link,
    "montahd://open?url=https%3A%2F%2Fmontahd.vercel.app&slug=jogos360",
  );
});

test("inclui sessao de instalacao no link profundo", () => {
  const link = buildMontaHDCatalogLink(
    "https://montahd.vercel.app",
    "jogos360",
    ["abc-123", "def-456"],
    { installSession: "sess-xyz" },
  );
  assert.doesNotMatch(link, /entries=/);
  assert.match(link, /session=sess-xyz/);
});

test("inclui ids na url quando nao ha sessao nem token", () => {
  const link = buildMontaHDCatalogLink(
    "https://montahd.vercel.app",
    "jogos360",
    ["abc-123", "def-456"],
  );
  assert.match(link, /entries=abc-123%2Cdef-456/);
  assert.doesNotMatch(link, /session=/);
  assert.doesNotMatch(link, /token=/);
});

test("parseia ids do parametro entries", () => {
  assert.deepEqual(parseMontaHDEntryIds("a,b, c"), ["a", "b", "c"]);
  assert.deepEqual(parseMontaHDEntryIds(""), []);
});
