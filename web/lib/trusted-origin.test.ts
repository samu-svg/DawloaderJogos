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

test("aceita www e domínio raiz como o mesmo site", () => {
  const request = new Request("https://www.montahds.app/api/auth/signup", {
    headers: {
      origin: "https://montahds.app",
      host: "www.montahds.app",
    },
  });
  assert.equal(isTrustedAuthOrigin(request, { requireOrigin: true }), true);
});

test("aceita origin www contra host sem www", () => {
  const request = new Request("https://montahds.app/api/auth/signup", {
    headers: {
      origin: "https://www.montahds.app",
      host: "montahds.app",
    },
  });
  assert.equal(isTrustedAuthOrigin(request, { requireOrigin: true }), true);
});

test("aceita origin raiz quando SITE_URL é www", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.montahds.app";
  const request = new Request("https://www.montahds.app/api/auth/signup", {
    headers: {
      origin: "https://montahds.app",
      host: "other.example",
    },
  });
  assert.equal(isTrustedAuthOrigin(request, { requireOrigin: true }), true);
  if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = previous;
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
