import test from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedCatalogOrigin,
  normalizeSiteUrl,
  parseMontaHDDeepLink,
  requireAllowedCatalogOrigin,
} from "./catalog-launch.ts";

test("normalizeSiteUrl descarta localhost e URLs inválidas", () => {
  assert.equal(normalizeSiteUrl("http://localhost:3000"), "https://montahd.vercel.app");
  assert.equal(normalizeSiteUrl("http://127.0.0.1:3000"), "https://montahd.vercel.app");
  assert.equal(normalizeSiteUrl("ftp://example.com"), "https://montahd.vercel.app");
  assert.equal(normalizeSiteUrl("https://evil.example"), "https://montahd.vercel.app");
  assert.equal(normalizeSiteUrl("https://montahd.vercel.app/"), "https://montahd.vercel.app");
});

test("localhost só entra na allowlist quando o app não está empacotado", () => {
  assert.equal(
    normalizeSiteUrl("http://localhost:3000", { allowLocalhost: true }),
    "http://localhost:3000",
  );
  assert.equal(isAllowedCatalogOrigin("http://127.0.0.1:3000", { allowLocalhost: true }), true);
  assert.equal(isAllowedCatalogOrigin("http://localhost:3000"), false);
  assert.equal(isAllowedCatalogOrigin("https://montahd.vercel.app"), true);
  assert.equal(isAllowedCatalogOrigin("https://evil.example"), false);
});

test("IPC recusa origem fora da lista", () => {
  assert.throws(
    () => requireAllowedCatalogOrigin("https://evil.example"),
    /não permitida/,
  );
  assert.equal(
    requireAllowedCatalogOrigin("https://montahd.vercel.app/"),
    "https://montahd.vercel.app",
  );
  assert.equal(
    requireAllowedCatalogOrigin("http://localhost:3000", { allowLocalhost: true }),
    "http://localhost:3000",
  );
});

test("deep link com origem estranha é ignorado", () => {
  assert.equal(
    parseMontaHDDeepLink(
      "montahd://open?url=https%3A%2F%2Fevil.example&slug=jogos360",
    ),
    null,
  );
  const local = parseMontaHDDeepLink(
    "montahd://open?url=http%3A%2F%2Flocalhost%3A3000&slug=jogos360",
    { allowLocalhost: true },
  );
  assert.ok(local);
  assert.equal(local.baseUrl, "http://localhost:3000");
  assert.equal(
    parseMontaHDDeepLink(
      "montahd://open?url=http%3A%2F%2Flocalhost%3A3000&slug=jogos360",
    ),
    null,
  );
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
