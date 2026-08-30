import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSafeExternalUrl,
  isBlockedResolvedAddress,
  setDnsResolverForTests,
  validateExternalUrl,
} from "./safe-external-url.ts";

const publicResolver = async (hostname: string) => {
  if (hostname === "drive.google.com") {
    return [{ address: "142.250.185.206", family: 4 }];
  }
  if (hostname === "evil-rebind.example") {
    return [{ address: "10.0.0.1", family: 4 }];
  }
  throw new Error(`host de teste não mockado: ${hostname}`);
};

test.after(() => {
  setDnsResolverForTests(null);
});

test("aceita URL pública https", () => {
  const result = assertSafeExternalUrl("https://example.com/file.zip");
  assert.equal(result.ok, true);
});

test("bloqueia metadata e localhost", () => {
  assert.equal(assertSafeExternalUrl("http://169.254.169.254/").ok, false);
  assert.equal(assertSafeExternalUrl("http://localhost/").ok, false);
  assert.equal(assertSafeExternalUrl("http://metadata.google.internal/").ok, false);
});

test("bloqueia RFC1918 e loopback literais", () => {
  assert.equal(assertSafeExternalUrl("http://127.0.0.1/").ok, false);
  assert.equal(assertSafeExternalUrl("http://10.0.0.1/").ok, false);
  assert.equal(assertSafeExternalUrl("http://192.168.1.1/").ok, false);
  assert.equal(assertSafeExternalUrl("http://172.16.0.1/").ok, false);
});

test("bloqueia esquemas não http(s)", () => {
  assert.equal(assertSafeExternalUrl("file:///etc/passwd").ok, false);
  assert.equal(assertSafeExternalUrl("ftp://example.com/x").ok, false);
});

test("isBlockedResolvedAddress: IPv4 privado e link-local/metadata", () => {
  assert.equal(isBlockedResolvedAddress("10.0.0.1"), true);
  assert.equal(isBlockedResolvedAddress("172.16.0.1"), true);
  assert.equal(isBlockedResolvedAddress("192.168.0.1"), true);
  assert.equal(isBlockedResolvedAddress("127.0.0.1"), true);
  assert.equal(isBlockedResolvedAddress("169.254.169.254"), true);
});

test("isBlockedResolvedAddress: CGNAT 100.64/10", () => {
  assert.equal(isBlockedResolvedAddress("100.64.0.1"), true);
  assert.equal(isBlockedResolvedAddress("100.127.255.254"), true);
  assert.equal(isBlockedResolvedAddress("100.63.255.254"), false);
});

test("isBlockedResolvedAddress: IPv6 loopback e ULA", () => {
  assert.equal(isBlockedResolvedAddress("::1"), true);
  assert.equal(isBlockedResolvedAddress("fc00::1"), true);
  assert.equal(isBlockedResolvedAddress("fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"), true);
  assert.equal(isBlockedResolvedAddress("fe80::1"), true);
});

test("isBlockedResolvedAddress: IPv4-mapped em IPv6", () => {
  assert.equal(isBlockedResolvedAddress("::ffff:10.0.0.1"), true);
  assert.equal(isBlockedResolvedAddress("::ffff:169.254.169.254"), true);
  assert.equal(isBlockedResolvedAddress("::ffff:8.8.8.8"), false);
});

test("isBlockedResolvedAddress: IPv4 público legítimo", () => {
  assert.equal(isBlockedResolvedAddress("8.8.8.8"), false);
  assert.equal(isBlockedResolvedAddress("142.250.185.206"), false);
});

test("validateExternalUrl aceita host público com DNS mockado", async () => {
  setDnsResolverForTests(publicResolver);
  const result = await validateExternalUrl("https://drive.google.com/uc?id=abc");
  assert.equal(result.ok, true);
});

test("validateExternalUrl bloqueia DNS rebinding para IP interno", async () => {
  setDnsResolverForTests(publicResolver);
  const result = await validateExternalUrl("https://evil-rebind.example/file.zip");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /internos/i);
  }
});
