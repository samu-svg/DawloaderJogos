import path from "node:path";

const authorized = new Set<string>();

function keyFor(rootDir: string): string {
  return path.resolve(rootDir).toLowerCase();
}

export function rememberAuthorizedRoot(rootDir: string): string {
  const resolved = path.resolve(rootDir);
  authorized.add(keyFor(resolved));
  return resolved;
}

export function assertAuthorizedRoot(rootDir: string): string {
  const resolved = path.resolve(rootDir);
  if (!authorized.has(keyFor(resolved))) {
    throw new Error(
      "Escolha a pasta do HD pelo botão do app antes de continuar.",
    );
  }
  return resolved;
}

/** Test helper — clears the in-memory allowlist. */
export function resetAuthorizedRootsForTests(): void {
  authorized.clear();
}
