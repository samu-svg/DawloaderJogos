import { SafeExternalUrlError, safeExternalFetch } from "@/lib/safe-external-url";

export type ProbeResult =
  | { ok: true; sizeBytes: number; fileName: string | null }
  | { ok: false; error: string };

const PROBE_TIMEOUT_MS = 12000;

const SHARE_PAGE_MESSAGE =
  "Este link abre uma página de compartilhamento, não o arquivo. O app precisa de um link direto — aquele que começa a baixar o arquivo sozinho.";

function fileNameFromDisposition(value: string | null): string | null {
  if (!value) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(value);
  return match ? decodeURIComponent(match[1]) : null;
}

function isHtml(contentType: string): boolean {
  return (
    contentType.startsWith("text/html") || contentType.startsWith("application/xhtml")
  );
}

/**
 * Checks that a link really serves file bytes before it is saved. A share page
 * answers with HTML, and the desktop app would store that page as the "game",
 * so the mistake is caught here instead of on someone else's disk.
 */
export async function probeDownloadUrl(url: string): Promise<ProbeResult> {
  let response: Response;

  try {
    response = await safeExternalFetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    // Plenty of file hosts refuse HEAD; a one byte ranged GET settles it.
    if (response.status === 405 || response.status === 501 || response.status === 403) {
      response = await safeExternalFetch(url, {
        headers: { Range: "bytes=0-0" },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
    }
  } catch (error) {
    if (error instanceof SafeExternalUrlError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error:
        "Não foi possível acessar o link. Confira se ele está público e tente de novo.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `O link respondeu com erro ${response.status}. Use um link direto e público.`,
    };
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (isHtml(contentType)) {
    return { ok: false, error: SHARE_PAGE_MESSAGE };
  }

  const rangeTotal = /\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
  const declared = rangeTotal
    ? Number(rangeTotal[1])
    : Number(response.headers.get("content-length") ?? "0");
  const sizeBytes = Number.isFinite(declared) && declared > 0 ? declared : 0;

  return {
    ok: true,
    sizeBytes,
    fileName: fileNameFromDisposition(response.headers.get("content-disposition")),
  };
}
