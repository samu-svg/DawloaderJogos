import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDawloaderCatalogLink,
  parseDawloaderEntryIds,
} from "./dawloader-link.ts";

test("monta link profundo com url e slug", () => {
  const link = buildDawloaderCatalogLink(
    "https://dawloader.vercel.app/",
    "jogos360",
  );
  assert.equal(
    link,
    "dawloader://open?url=https%3A%2F%2Fdawloader.vercel.app&slug=jogos360",
  );
});

test("inclui ids selecionados no link profundo", () => {
  const link = buildDawloaderCatalogLink(
    "https://dawloader.vercel.app",
    "jogos360",
    ["abc-123", "def-456"],
  );
  assert.match(link, /entries=abc-123%2Cdef-456/);
});

test("parseia ids do parametro entries", () => {
  assert.deepEqual(parseDawloaderEntryIds("a,b, c"), ["a", "b", "c"]);
  assert.deepEqual(parseDawloaderEntryIds(""), []);
});
