import assert from "node:assert/strict";
import { test } from "node:test";
import { isTrustedAuthOrigin } from "./trusted-origin.ts";

test("aceita mesma origem do Host", () => {
  const request = new Request("https://montahd.vercel.app/api/auth/login", {
    headers: {
      origin: "https://montahd.vercel.app",
      host: "montahd.vercel.app",
    },
  });
  assert.equal(isTrustedAuthOrigin(request), true);
});

test("recusa origem de outro site", () => {
  const request = new Request("https://montahd.vercel.app/api/auth/login", {
    headers: {
      origin: "https://evil.example",
      host: "montahd.vercel.app",
    },
  });
  assert.equal(isTrustedAuthOrigin(request), false);
});

test("sem Origin nem Referer segue (navegador same-origin)", () => {
  const request = new Request("https://montahd.vercel.app/api/auth/login", {
    headers: { host: "montahd.vercel.app" },
  });
  assert.equal(isTrustedAuthOrigin(request), true);
});
