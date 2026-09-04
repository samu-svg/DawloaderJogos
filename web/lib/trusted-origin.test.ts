import assert from "node:assert/strict";
import { test } from "node:test";
import { isTrustedAuthOrigin } from "./trusted-origin.ts";

test("aceita mesma origem do Host", () => {
  const request = new Request("https://www.montahds.app/api/auth/login", {
    headers: {
      origin: "https://www.montahds.app",
      host: "www.montahds.app",
    },
  });
  assert.equal(isTrustedAuthOrigin(request), true);
});

test("recusa origem de outro site", () => {
  const request = new Request("https://www.montahds.app/api/auth/login", {
    headers: {
      origin: "https://evil.example",
      host: "www.montahds.app",
    },
  });
  assert.equal(isTrustedAuthOrigin(request), false);
});

test("sem Origin nem Referer segue só fora de produção", () => {
  const request = new Request("https://www.montahds.app/api/auth/login", {
    headers: { host: "www.montahds.app" },
  });
  assert.equal(isTrustedAuthOrigin(request, { requireOrigin: false }), true);
  assert.equal(isTrustedAuthOrigin(request, { requireOrigin: true }), false);
});
