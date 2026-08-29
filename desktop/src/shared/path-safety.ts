import path from "node:path";

/** Verifica se `targetPath` está dentro de `rootDir` (após path.resolve). */
export function isPathUnderRoot(rootDir: string, targetPath: string): boolean {
  const root = path.resolve(rootDir);
  const target = path.resolve(targetPath);
  const relative = path.relative(root, target);
  return (
    relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}
