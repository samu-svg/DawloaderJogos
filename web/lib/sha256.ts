/** SHA-256 hex lowercase de 64 caracteres. */

export function normalizeSha256(value: string | null | undefined): string | null {
  const hash = value?.trim().toLowerCase() ?? "";
  return /^[0-9a-f]{64}$/.test(hash) ? hash : null;
}

export function requireHostedSha256(
  kind: "hosted" | "external",
  value: string | null | undefined,
): { ok: true; sha256: string | null } | { ok: false; error: string } {
  const sha256 = normalizeSha256(value);
  if (kind === "hosted") {
    if (!sha256) {
      return {
        ok: false,
        error: "Informe o SHA-256 (64 caracteres hex) do arquivo hospedado.",
      };
    }
    return { ok: true, sha256 };
  }
  return { ok: true, sha256 };
}
