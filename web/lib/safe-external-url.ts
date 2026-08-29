import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
]);

const MAX_REDIRECTS = 5;

export type DnsLookupResult = { address: string; family: number };

export type DnsResolver = (hostname: string) => Promise<DnsLookupResult[]>;

async function defaultDnsResolver(hostname: string): Promise<DnsLookupResult[]> {
  return lookup(hostname, { all: true });
}

let dnsResolver: DnsResolver = defaultDnsResolver;

/** Apenas para testes — passe `null` para restaurar o resolvedor padrão. */
export function setDnsResolverForTests(resolver: DnsResolver | null): void {
  dnsResolver = resolver ?? defaultDnsResolver;
}

let blockedRanges: BlockList | null = null;

function getBlockedRanges(): BlockList {
  if (blockedRanges) return blockedRanges;

  const bl = new BlockList();
  bl.addSubnet("127.0.0.0", 8, "ipv4");
  bl.addSubnet("0.0.0.0", 8, "ipv4");
  bl.addSubnet("10.0.0.0", 8, "ipv4");
  bl.addSubnet("172.16.0.0", 12, "ipv4");
  bl.addSubnet("192.168.0.0", 16, "ipv4");
  bl.addSubnet("169.254.0.0", 16, "ipv4");
  bl.addSubnet("100.64.0.0", 10, "ipv4");
  bl.addAddress("::1", "ipv6");
  bl.addSubnet("fc00::", 7, "ipv6");
  bl.addSubnet("fe80::", 10, "ipv6");
  blockedRanges = bl;
  return bl;
}

function unmapIpv4FromIpv6(address: string): string | null {
  const lower = address.toLowerCase();
  if (!lower.startsWith("::ffff:")) return null;
  const v4 = lower.slice("::ffff:".length);
  return isIP(v4) === 4 ? v4 : null;
}

/** Rejeita endereço resolvido em faixa proibida (RFC1918, metadata, ULA, etc.). */
export function isBlockedResolvedAddress(address: string): boolean {
  const kind = isIP(address);
  if (!kind) return true;

  const bl = getBlockedRanges();
  if (bl.check(address, kind === 4 ? "ipv4" : "ipv6")) return true;

  if (kind === 6) {
    const mapped = unmapIpv4FromIpv6(address);
    if (mapped && bl.check(mapped, "ipv4")) return true;
  }

  return false;
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

/** Checagens síncronas de URL (protocolo, host literal, blocklist de nomes). */
export function assertSafeExternalUrl(
  urlString: string,
): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { ok: false, error: "URL inválida." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Só links http ou https são permitidos." };
  }

  if (url.username || url.password) {
    return { ok: false, error: "URL inválida." };
  }

  const hostname = normalizeHostname(url.hostname);
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    return { ok: false, error: "Este host não é permitido." };
  }

  if (isIP(hostname) && isBlockedResolvedAddress(hostname)) {
    return { ok: false, error: "Endereços internos não são permitidos." };
  }

  return { ok: true, url };
}

async function resolveHostname(
  hostname: string,
  resolveHost: DnsResolver,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isIP(hostname)) {
    return { ok: true };
  }

  let records: DnsLookupResult[];
  try {
    records = await resolveHost(hostname);
  } catch {
    return { ok: false, error: "Não foi possível resolver o host." };
  }

  if (!records.length) {
    return { ok: false, error: "Host sem endereço IP." };
  }

  for (const { address } of records) {
    if (isBlockedResolvedAddress(address)) {
      return { ok: false, error: "Endereços internos não são permitidos." };
    }
  }

  return { ok: true };
}

/** Valida URL + resolução DNS antes de conectar (bloqueia DNS rebinding). */
export async function validateExternalUrl(
  urlString: string,
  resolveHost: DnsResolver = dnsResolver,
): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  const structural = assertSafeExternalUrl(urlString);
  if (!structural.ok) return structural;

  const hostname = normalizeHostname(structural.url.hostname);
  const resolved = await resolveHostname(hostname, resolveHost);
  if (!resolved.ok) return resolved;

  return structural;
}

/**
 * Fetch com validação de cada salto de redirect — evita SSRF via Location interno.
 *
 * TOCTOU: após validar os IPs com DNS, `fetch` resolve o host de novo no socket.
 * No runtime Node/Vercel não há API estável para fixar a conexão no IP validado
 * (sem agent HTTP com hook de lookup). A checagem DNS ainda bloqueia rebinding
 * óbvio e redirects para hosts internos; a janela residual entre lookup e connect
 * permanece teoricamente explorável por TTL DNS muito curto.
 */
export async function safeExternalFetch(
  urlString: string,
  init: RequestInit,
  resolveHost: DnsResolver = dnsResolver,
): Promise<Response> {
  let current = urlString;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const check = await validateExternalUrl(current, resolveHost);
    if (!check.ok) {
      throw new SafeExternalUrlError(check.error);
    }

    const response = await fetch(current, { ...init, redirect: "manual" });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || hop === MAX_REDIRECTS) {
        throw new SafeExternalUrlError("Redirecionamento inválido ou em excesso.");
      }
      current = new URL(location, current).toString();
      continue;
    }

    return response;
  }

  throw new SafeExternalUrlError("Redirecionamento inválido ou em excesso.");
}

export class SafeExternalUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeExternalUrlError";
  }
}
