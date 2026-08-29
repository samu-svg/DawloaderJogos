import path from "node:path";
import { isPathUnderRoot } from "../shared/path-safety";
import { validateDestination } from "../shared/manifest";

/**
 * Resolves a manifest destination under the user-chosen root. Returns null if the
 * path would escape that root — the last check before anything hits the disk.
 */
export function resolveUnderRoot(
  rootDir: string,
  destination: string,
): { ok: true; fullPath: string } | { ok: false; error: string } {
  const validated = validateDestination(destination);
  if (!validated.ok) return validated;

  const fullPath = path.resolve(rootDir, ...validated.destination.split("/"));
  if (!isPathUnderRoot(rootDir, fullPath)) {
    return { ok: false, error: "O destino tenta sair da pasta raiz escolhida." };
  }

  return { ok: true, fullPath };
}
