import assert from "node:assert/strict";
import test from "node:test";
import {
  DESKTOP_APP_VERSION,
  desktopBuildPublicPath,
  desktopDownloadApiHref,
  getDesktopBuild,
  getDesktopBuilds,
  resolveDesktopBuildId,
} from "./desktop-download.ts";

test("oferece as quatro builds de Windows", () => {
  const ids = getDesktopBuilds().map((item) => item.id);
  assert.deepEqual(ids, ["win10-x64", "win10-ia32", "win7-x64", "win7-ia32"]);
});

test("links de download passam pela API autenticada", () => {
  const build = getDesktopBuild("win10-x64");
  assert.equal(build.href, desktopDownloadApiHref("win10-x64"));
});

test("32-bit e Windows 7/8 são versões novas", () => {
  assert.equal(getDesktopBuild("win10-x64").preview, undefined);
  assert.equal(getDesktopBuild("win10-ia32").preview, true);
  assert.equal(getDesktopBuild("win7-x64").preview, true);
  assert.equal(getDesktopBuild("win7-ia32").preview, true);
});

test("resolveDesktopBuildId valida ids conhecidos", () => {
  assert.equal(resolveDesktopBuildId("win10-x64"), "win10-x64");
  assert.equal(resolveDesktopBuildId("invalid"), null);
});

test("arquivos públicos continuam em /downloads para auto-update", () => {
  assert.equal(
    desktopBuildPublicPath(getDesktopBuild("win10-x64")),
    `/downloads/MontaHD-${DESKTOP_APP_VERSION}-setup.exe`,
  );
  assert.equal(
    desktopBuildPublicPath(getDesktopBuild("win10-ia32")),
    `/downloads/MontaHD-${DESKTOP_APP_VERSION}-ia32-setup.exe`,
  );
  assert.equal(
    desktopBuildPublicPath(getDesktopBuild("win7-x64")),
    `/downloads/legacy/MontaHD-${DESKTOP_APP_VERSION}-legacy-x64-setup.exe`,
  );
});
