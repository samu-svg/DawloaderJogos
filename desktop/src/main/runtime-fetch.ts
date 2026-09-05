/**
 * Electron 35+ tem fetch global (Node 18+). Electron 22 (Node 16) não —
 * a linha legado empacota `undici` e cai neste fallback.
 */
export function runtimeFetch(url: string, init?: RequestInit): Promise<Response> {
  const nativeFetch = (globalThis as { fetch?: typeof fetch }).fetch;
  if (typeof nativeFetch === "function") {
    return nativeFetch(url, init);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const undici = require("undici") as {
      fetch: (input: string, init?: RequestInit) => Promise<Response>;
    };
    return undici.fetch(url, init);
  } catch {
    throw new Error(
      "Este Windows não consegue baixar arquivos. Use o instalador legado do MontaHD ou atualize o sistema.",
    );
  }
}
