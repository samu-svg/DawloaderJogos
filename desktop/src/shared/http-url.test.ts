import assert from "node:assert/strict";
import test from "node:test";
import {
  assertHttpUrl,
  assertSafeDownloadUrl,
  isBlockedDownloadHost,
  windowsExplorerOpenCommand,
  windowsExternalOpenCommand,
} from "../shared/http-url.ts";

test("assertHttpUrl rejeita esquemas perigosos", () => {
  for (const url of [
    "javascript:alert(1)",
    "file:///C:/Windows/System32",
    "data:text/html,<script>alert(1)</script>",
    "cmd:///c calc",
  ]) {
    assert.throws(() => assertHttpUrl(url), /inválida/, url);
  }
});

test("assertHttpUrl rejeita URL sem esquema http(s)", () => {
  assert.throws(() => assertHttpUrl("ftp://example.com"), /inválida/);
});

test("windowsExternalOpenCommand isola metacaracteres em argv", () => {
  const cases = [
    "https://montahd.vercel.app/baixar?x=1&y=2|calc",
    "https://montahd.vercel.app/path^test",
    "https://montahd.vercel.app/`whoami`",
  ];

  for (const url of cases) {
    const { command, args } = windowsExternalOpenCommand(url);
    assert.match(command.replace(/\\/g, "/"), /\/System32\/rundll32\.exe$/i);
    assert.deepEqual(args, [
      "url.dll,FileProtocolHandler",
      assertHttpUrl(url).toString(),
    ]);
    assert.equal(args.length, 2);
    assert.ok(!args[1].includes('"'));
  }
});

test("isBlockedDownloadHost recusa metadados e faixas privadas", () => {
  assert.equal(isBlockedDownloadHost("cdn.example.com"), false);
  assert.equal(isBlockedDownloadHost("169.254.169.254"), true);
  assert.equal(isBlockedDownloadHost("127.0.0.1"), true);
  assert.equal(isBlockedDownloadHost("10.0.0.8"), true);
  assert.equal(isBlockedDownloadHost("192.168.1.1"), true);
  assert.equal(isBlockedDownloadHost("localhost"), true);
  assert.throws(
    () => assertSafeDownloadUrl("http://169.254.169.254/latest/meta-data"),
    /interno/,
  );
});

test("windowsExplorerOpenCommand usa explorer.exe e recusa esquema perigoso", () => {
  const { command, args } = windowsExplorerOpenCommand(
    "https://montahd.vercel.app/baixar",
  );
  assert.match(command.replace(/\\/g, "/"), /\/explorer\.exe$/i);
  assert.deepEqual(args, ["https://montahd.vercel.app/baixar"]);
  assert.throws(
    () => windowsExplorerOpenCommand("file:///C:/Windows/notepad.exe"),
    /inválida/,
  );
});

test("windowsExternalOpenCommand recusa esquema perigoso antes de montar argv", () => {
  assert.throws(
    () => windowsExternalOpenCommand("file:///C:/evil&calc"),
    /inválida/,
  );
});
