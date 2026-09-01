const BLOCKED_DOWNLOAD_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
]);

export function assertHttpUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL inválida.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL inválida.");
  }
  return parsed;
}

/** Blocks literal private / metadata hosts. Public CDNs still pass. */
export function isBlockedDownloadHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_DOWNLOAD_HOSTS.has(host) || host.endsWith(".localhost")) return true;

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }
  return false;
}

export function assertSafeDownloadUrl(url: string): URL {
  const parsed = assertHttpUrl(url);
  if (isBlockedDownloadHost(parsed.hostname)) {
    throw new Error("URL de download aponta para um endereço interno.");
  }
  return parsed;
}

/** Comando Windows sem shell: argv isolado, sem interpretar &, |, ^ ou `. */
export function windowsExternalOpenCommand(url: string): {
  command: string;
  args: string[];
} {
  const safeUrl = assertHttpUrl(url).toString();
  return {
    command: "rundll32",
    args: ["url.dll,FileProtocolHandler", safeUrl],
  };
}
