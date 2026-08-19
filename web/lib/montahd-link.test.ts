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

test("inclui ids selecionados e token no link profundo", () => {
  const link = buildMontaHDCatalogLink(
    "https://montahd.vercel.app",
    "jogos360",
    ["abc-123", "def-456"],
    "tok-xyz",
  );
  assert.match(link, /entries=abc-123%2Cdef-456/);
  assert.match(link, /token=tok-xyz/);
});

test("parseia ids do parametro entries", () => {
  assert.deepEqual(parseMontaHDEntryIds("a,b, c"), ["a", "b", "c"]);
  assert.deepEqual(parseMontaHDEntryIds(""), []);
});
