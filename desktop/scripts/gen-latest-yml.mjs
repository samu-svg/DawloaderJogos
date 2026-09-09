import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

function buildYml(version, fileName, filePath) {
  const buf = fs.readFileSync(filePath);
  const sha512 = crypto.createHash("sha512").update(buf).digest("base64");
  const size = buf.length;
  return [
    `version: ${version}`,
    "files:",
    `  - url: ${fileName}`,
    `    sha512: ${sha512}`,
    `    size: ${size}`,
    `path: ${fileName}`,
    `sha512: ${sha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    "",
  ].join("\n");
}

const version = "0.6.31";
const desktop = path.resolve("release631");
const legacy = path.resolve("../desktop-legacy/release631-legacy");

const targets = [
  [desktop, "latest.yml", `MontaHD-${version}-setup.exe`],
  [desktop, "latest-ia32.yml", `MontaHD-${version}-ia32-setup.exe`],
  [legacy, "latest.yml", `MontaHD-${version}-legacy-x64-setup.exe`],
  [legacy, "latest-ia32.yml", `MontaHD-${version}-legacy-ia32-setup.exe`],
];

for (const [dir, ymlName, exeName] of targets) {
  const exePath = path.join(dir, exeName);
  const outPath = path.join(dir, ymlName);
  fs.writeFileSync(outPath, buildYml(version, exeName, exePath));
  console.log("OK", outPath);
}
