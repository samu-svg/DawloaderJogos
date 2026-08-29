import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSiteUrl, parseMontaHDDeepLink } from "./catalog-launch.ts";

test("normalizeSiteUrl descarta localhost e URLs inválidas", () => {
  assert.equal(normalizeSiteUrl("http://localhost:3000"), "https://montahd.vercel.app");
  assert.equal(normalizeSiteUrl("http://127.0.0.1:3000"), "https://montahd.vercel.app");
  assert.equal(normalizeSiteUrl("ftp://example.com"), "https://montahd.vercel.app");
  assert.equal(normalizeSiteUrl("https://montahd.vercel.app/"), "https://montahd.vercel.app");
});

test("parseia varios ids no parametro entries", () => {
  const launch = parseMontaHDDeepLink(
    "montahd://open?url=https%3A%2F%2Fmontahd.vercel.app&slug=jogos360&entries=id-a,id-b,id-c&session=sess",
  );

  assert.ok(launch);
  assert.deepEqual(launch.entryIds, ["id-a", "id-b", "id-c"]);
  assert.equal(launch.installSession, "sess");
  assert.equal(launch.manifestToken, null);
});

test("aceita launch so com sessao (ids ficam no manifesto filtrado)", () => {
  const launch = parseMontaHDDeepLink(
    "montahd://open?url=https%3A%2F%2Fmontahd.vercel.app&slug=jogos360&session=sess",
  );

  assert.ok(launch);
  assert.deepEqual(launch.entryIds, []);
  assert.equal(launch.installSession, "sess");
});

test("mantem compatibilidade com token legado", () => {
  const launch = parseMontaHDDeepLink(
    "montahd://open?url=https%3A%2F%2Fmontahd.vercel.app&slug=jogos360&token=tok",
  );

  assert.ok(launch);
  assert.equal(launch.manifestToken, "tok");
  assert.equal(launch.installSession, null);
});
