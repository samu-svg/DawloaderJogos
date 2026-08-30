import assert from "node:assert/strict";
import test from "node:test";
import { assertHttpUrl, windowsExternalOpenCommand } from "../shared/http-url.ts";

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
    assert.equal(command, "rundll32");
    assert.deepEqual(args, [
      "url.dll,FileProtocolHandler",
      assertHttpUrl(url).toString(),
    ]);
    assert.equal(args.length, 2);
    assert.ok(!args[1].includes('"'));
  }
});

test("windowsExternalOpenCommand recusa esquema perigoso antes de montar argv", () => {
  assert.throws(
    () => windowsExternalOpenCommand("file:///C:/evil&calc"),
    /inválida/,
  );
});
