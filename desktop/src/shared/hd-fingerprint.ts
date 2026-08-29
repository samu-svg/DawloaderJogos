import { createHash } from "node:crypto";
import path from "node:path";

/** Identificador estável da pasta raiz escolhida pelo usuário. */
export function computeHdFingerprint(rootDir: string): string {
  const normalized = path.resolve(rootDir).replace(/\\/g, "/").toLowerCase();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
