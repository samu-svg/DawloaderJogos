import path from "node:path";
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

  const root = path.resolve(rootDir);
  const fullPath = path.resolve(root, ...validated.destination.split("/"));

  const relative = path.relative(root, fullPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return { ok: false, error: "O destino tenta sair da pasta raiz escolhida." };
  }

  return { ok: true, fullPath };
}
