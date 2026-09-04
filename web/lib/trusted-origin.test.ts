import assert from "node:assert/strict";
import { test } from "node:test";
import { isTrustedAuthOrigin } from "./trusted-origin.ts";

test("aceita mesma origem do Host", () => {
  const request = new Request("https://montahds.app/api/auth/login", {
    headers: {
      origin: "https://montahds.app",
      host: "montahds.app",
    },
  });
  assert.equal(isTrustedAuthOrigin(request), true);
});

test("recusa origem de outro site", () => {
  const request = new Request("https://montahds.app/api/auth/login", {
    headers: {
      origin: "https://evil.example",
      host: "montahds.app",
    },
  });
  assert.equal(isTrustedAuthOrigin(request), false);
});

test("sem Origin nem Referer segue só fora de produção", () => {
  const request = new Request("https://montahds.app/api/auth/login", {
    headers: { host: "montahds.app" },
  });
  assert.equal(isTrustedAuthOrigin(request, { requireOrigin: false }), true);
  assert.equal(isTrustedAuthOrigin(request, { requireOrigin: true }), false);
});
