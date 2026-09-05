import assert from "node:assert/strict";
import test from "node:test";
import { DESKTOP_APP_VERSION, getDesktopBuild, getDesktopBuilds } from "./desktop-download.ts";

test("oferece as quatro builds de Windows", () => {
  const ids = getDesktopBuilds().map((item) => item.id);
  assert.deepEqual(ids, ["win10-x64", "win10-ia32", "win7-x64", "win7-ia32"]);
});

test("x64 atual continua no caminho clássico", () => {
  const build = getDesktopBuild("win10-x64");
  assert.equal(build.href, `/downloads/MontaHD-${DESKTOP_APP_VERSION}-setup.exe`);
});

test("32-bit e Windows 7/8 são versões novas", () => {
  assert.equal(getDesktopBuild("win10-x64").preview, undefined);
  assert.equal(getDesktopBuild("win10-ia32").preview, true);
  assert.equal(getDesktopBuild("win7-x64").preview, true);
  assert.equal(getDesktopBuild("win7-ia32").preview, true);
});

test("ia32 e legado usam arquivos separados", () => {
  assert.equal(
    getDesktopBuild("win10-ia32").href,
    `/downloads/MontaHD-${DESKTOP_APP_VERSION}-ia32-setup.exe`,
  );
  assert.equal(
    getDesktopBuild("win7-x64").href,
    `/downloads/legacy/MontaHD-${DESKTOP_APP_VERSION}-legacy-x64-setup.exe`,
  );
  assert.equal(
    getDesktopBuild("win7-ia32").href,
    `/downloads/legacy/MontaHD-${DESKTOP_APP_VERSION}-legacy-ia32-setup.exe`,
  );
});
