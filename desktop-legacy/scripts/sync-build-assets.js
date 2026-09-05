const fs = require("node:fs");
const path = require("node:path");

const desktop = path.join(__dirname, "..", "..", "desktop");
const copies = [
  { from: path.join(desktop, "build"), to: path.join(__dirname, "..", "build") },
  { from: path.join(desktop, "renderer"), to: path.join(__dirname, "..", "renderer") },
];

for (const { from, to } of copies) {
  if (!fs.existsSync(from)) {
    throw new Error(`Pasta de assets ausente: ${from}`);
  }
  fs.cpSync(from, to, { recursive: true });
  console.log(`OK — copiado ${from} -> ${to}`);
}
