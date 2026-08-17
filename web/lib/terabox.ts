const TERABOX_HOSTS = [
  "terabox.com",
  "1024tera.com",
  "1024terabox.com",
  "4funbox.com",
  "freeterabox.com",
  "teraboxapp.com",
  "dubox.com",
];

/** Reconhece links públicos do TeraBox e serviços equivalentes. */
export function isTeraboxUrl(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url.trim());
    if (protocol !== "http:" && protocol !== "https:") return false;
    const host = hostname.toLowerCase().replace(/^www\./, "");
    if (TERABOX_HOSTS.some((known) => host === known || host.endsWith(`.${known}`))) {
      return true;
    }
    // Subdomínios regionais: dm.1024tera.com, n.terabox.com, etc.
    return /(?:^|[.-])(terabox|1024tera|4funbox|dubox)(?:app)?(?:[.-]|$)/.test(
      host,
    );
  } catch {
    return false;
  }
}
